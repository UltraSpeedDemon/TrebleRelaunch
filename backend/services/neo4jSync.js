const {
  driver,
  database,
} = require("../providers/neo4j");

const NODE_BATCH_SIZE = 300;
const EDGE_BATCH_SIZE = 300;

function splitIntoBatches(
  items,
  size
) {
  const batches = [];

  for (
    let index = 0;
    index < items.length;
    index += size
  ) {
    batches.push(
      items.slice(
        index,
        index + size
      )
    );
  }

  return batches;
}

function cleanString(value) {
  return String(
    value || ""
  ).trim();
}

function normalizeNode(node) {
  return {
    id:
      cleanString(
        node?.id
      ),

    rawId:
      cleanString(
        node?.rawId
      ),

    type:
      cleanString(
        node?.type ||
        "entity"
      ).toLowerCase(),

    label:
      cleanString(
        node?.label ||
        "Treble Entity"
      ),

    image:
      cleanString(
        node?.image
      ),
  };
}

function normalizeEdge(edge) {
  let metadataJson = "{}";

  try {
    metadataJson =
      JSON.stringify(
        edge?.metadata || {}
      );
  } catch {
    metadataJson = "{}";
  }

  return {
    id:
      cleanString(
        edge?.id
      ),

    source:
      cleanString(
        edge?.source
      ),

    target:
      cleanString(
        edge?.target
      ),

    relationship:
      cleanString(
        edge?.relationship ||
        "RELATED"
      ).toUpperCase(),

    weight:
      Number(
        edge?.weight || 1
      ),

    metadataJson,
  };
}

async function syncNodeBatch(
  nodes,
  syncId
) {
  await driver.executeQuery(
    `
    UNWIND $nodes AS node

    MERGE (
      entity:TrebleEntity {
        graphId: node.id
      }
    )

    SET entity.rawId =
          node.rawId,
        entity.nodeType =
          node.type,
        entity.name =
          node.label,
        entity.image =
          node.image,
        entity.lastSyncId =
          $syncId,
        entity.lastSyncedAt =
          datetime()

    FOREACH (
      ignored IN CASE
        WHEN node.type = 'user'
        THEN [1]
        ELSE []
      END |
      SET entity:User
    )

    FOREACH (
      ignored IN CASE
        WHEN node.type = 'artist'
        THEN [1]
        ELSE []
      END |
      SET entity:Artist
    )

    FOREACH (
      ignored IN CASE
        WHEN node.type = 'album'
        THEN [1]
        ELSE []
      END |
      SET entity:Album
    )

    FOREACH (
      ignored IN CASE
        WHEN node.type IN [
          'track',
          'song'
        ]
        THEN [1]
        ELSE []
      END |
      SET entity:Song
    )
    `,
    {
      nodes,
      syncId,
    },
    {
      database,
    }
  );
}

async function syncEdgeBatch(
  edges,
  syncId
) {
  await driver.executeQuery(
    `
    UNWIND $edges AS edge

    MATCH (
      source:TrebleEntity {
        graphId: edge.source
      }
    )

    MATCH (
      target:TrebleEntity {
        graphId: edge.target
      }
    )

    MERGE (
      source
    )-[relationship:TREBLE_RELATIONSHIP {
      graphId: edge.id
    }]->(
      target
    )

    SET relationship.kind =
          edge.relationship,
        relationship.weight =
          edge.weight,
        relationship.metadataJson =
          edge.metadataJson,
        relationship.lastSyncId =
          $syncId,
        relationship.lastSyncedAt =
          datetime()
    `,
    {
      edges,
      syncId,
    },
    {
      database,
    }
  );
}

/*
 * Delete records that were not present in the latest complete
 * Firestore snapshot. Cleanup only runs after every node and
 * relationship batch has completed successfully.
 */
async function removeStaleGraphData(
  syncId
) {
  const relationshipResult =
    await driver.executeQuery(
      `
      MATCH ()-[
        relationship:TREBLE_RELATIONSHIP
      ]->()

      WHERE relationship.lastSyncId <>
        $syncId
        OR relationship.lastSyncId
          IS NULL

      DELETE relationship

      RETURN count(
        relationship
      ) AS removed
      `,
      {
        syncId,
      },
      {
        database,
      }
    );

  const nodeResult =
    await driver.executeQuery(
      `
      MATCH (
        entity:TrebleEntity
      )

      WHERE entity.lastSyncId <>
        $syncId
        OR entity.lastSyncId
          IS NULL

      DETACH DELETE entity

      RETURN count(
        entity
      ) AS removed
      `,
      {
        syncId,
      },
      {
        database,
      }
    );

  const relationshipsRemoved =
    relationshipResult.records[0]
      ?.get("removed")
      ?.toNumber?.() ||
    Number(
      relationshipResult.records[0]
        ?.get("removed") ||
      0
    );

  const nodesRemoved =
    nodeResult.records[0]
      ?.get("removed")
      ?.toNumber?.() ||
    Number(
      nodeResult.records[0]
        ?.get("removed") ||
      0
    );

  return {
    relationshipsRemoved,
    nodesRemoved,
  };
}

async function syncGraphToNeo4j(
  graph
) {
  const syncId =
    `sync-${Date.now()}`;

  const nodes =
    Array.isArray(
      graph?.nodes
    )
      ? graph.nodes
          .map(
            normalizeNode
          )
          .filter(
            (node) => node.id
          )
      : [];

  const edges =
    Array.isArray(
      graph?.edges
    )
      ? graph.edges
          .map(
            normalizeEdge
          )
          .filter(
            (edge) =>
              edge.id &&
              edge.source &&
              edge.target
          )
      : [];

  console.log(
    `[Neo4j] Starting ${syncId}: ${nodes.length} nodes and ${edges.length} relationships`
  );

  for (
    const batch of
    splitIntoBatches(
      nodes,
      NODE_BATCH_SIZE
    )
  ) {
    await syncNodeBatch(
      batch,
      syncId
    );
  }

  for (
    const batch of
    splitIntoBatches(
      edges,
      EDGE_BATCH_SIZE
    )
  ) {
    await syncEdgeBatch(
      batch,
      syncId
    );
  }

  const cleanup =
    await removeStaleGraphData(
      syncId
    );

  console.log(
    `[Neo4j] Completed ${syncId}: ${nodes.length} nodes, ${edges.length} relationships, ${cleanup.nodesRemoved} stale nodes removed, ${cleanup.relationshipsRemoved} stale relationships removed`
  );

  return {
    syncId,
    nodesSynced:
      nodes.length,
    relationshipsSynced:
      edges.length,
    ...cleanup,
  };
}

module.exports = {
  syncGraphToNeo4j,
};
