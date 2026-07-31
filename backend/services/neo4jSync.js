const {
  driver,
  database,
} = require("../providers/neo4j");

const NODE_BATCH_SIZE = 300;
const EDGE_BATCH_SIZE = 300;

/*
 * Only these relationship names may be inserted into Cypher.
 * This protects the query while allowing Neo4j to display real,
 * separately styled relationship types.
 */
const ALLOWED_RELATIONSHIP_TYPES =
  new Set([
    "ABOUT",
    "AUTHORED",
    "BY_ARTIST",
    "CONTAINS",
    "CREATED",
    "FOLLOWS",
    "FRIENDS_WITH",
    "FRIEND_RECOMMENDED",
    "LIKED",
    "ON_ALBUM",
    "PERFORMED",
    "POSTED_ABOUT",
    "RECEIVED",
    "RECOMMENDED",
    "REPLIES_TO",
    "REQUESTED_TO_FOLLOW",
    "REVIEWED",
    "REVIEWS",
    "SHARED",
    "SHARED_WITH",
    "SIMILAR",
    "SIMILAR_TASTE",
    "TASTE_SEED",
    "UPVOTED",
    "VIEWED",
    "RELATED",
  ]);

const NODE_LABELS = {
  album:
    "Album",
  artist:
    "Artist",
  post:
    "Post",
  reply:
    "Reply",
  review:
    "Review",
  track:
    "Song",
  song:
    "Song",
  user:
    "User",
};

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
    value === null ||
    value === undefined
      ? ""
      : value
  ).trim();
}

function cleanRelationshipType(
  value
) {
  const type =
    cleanString(
      value ||
      "RELATED"
    )
      .toUpperCase()
      .replace(
        /[^A-Z0-9_]/g,
        "_"
      );

  return ALLOWED_RELATIONSHIP_TYPES
    .has(type)
      ? type
      : "RELATED";
}

function safeJson(value) {
  try {
    return JSON.stringify(
      value || {}
    );
  } catch {
    return "{}";
  }
}

function normalizeNode(node) {
  const type =
    cleanString(
      node?.type ||
      "entity"
    ).toLowerCase();

  return {
    id:
      cleanString(
        node?.id
      ),

    rawId:
      cleanString(
        node?.rawId
      ),

    type,

    neo4jLabel:
      NODE_LABELS[type] ||
      "TrebleEntity",

    label:
      cleanString(
        node?.label ||
        "Treble Entity"
      ),

    image:
      cleanString(
        node?.image
      ),

    propertiesJson:
      safeJson(
        node?.properties
      ),
  };
}

function normalizeEdge(edge) {
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
      cleanRelationshipType(
        edge?.relationship
      ),

    weight:
      Number(
        edge?.weight || 1
      ),

    metadataJson:
      safeJson(
        edge?.metadata
      ),
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
      entity {
        graphId: node.id
      }
    )

    REMOVE entity:TrebleEntity

    SET entity.rawId =
          node.rawId,
        entity.nodeType =
          node.type,
        entity.name =
          node.label,
        entity.image =
          node.image,
        entity.propertiesJson =
          node.propertiesJson,
        entity.managedBy =
          'treble-sync',
        entity.lastSyncId =
          $syncId,
        entity.lastSyncedAt =
          datetime()

    FOREACH (
      ignored IN CASE
        WHEN node.neo4jLabel = 'User'
        THEN [1]
        ELSE []
      END |
      SET entity:User
    )

    FOREACH (
      ignored IN CASE
        WHEN node.neo4jLabel = 'Artist'
        THEN [1]
        ELSE []
      END |
      SET entity:Artist
    )

    FOREACH (
      ignored IN CASE
        WHEN node.neo4jLabel = 'Album'
        THEN [1]
        ELSE []
      END |
      SET entity:Album
    )

    FOREACH (
      ignored IN CASE
        WHEN node.neo4jLabel = 'Song'
        THEN [1]
        ELSE []
      END |
      SET entity:Song
    )

    FOREACH (
      ignored IN CASE
        WHEN node.neo4jLabel = 'Review'
        THEN [1]
        ELSE []
      END |
      SET entity:Review
    )

    FOREACH (
      ignored IN CASE
        WHEN node.neo4jLabel = 'Reply'
        THEN [1]
        ELSE []
      END |
      SET entity:Reply
    )

    FOREACH (
      ignored IN CASE
        WHEN node.neo4jLabel = 'Post'
        THEN [1]
        ELSE []
      END |
      SET entity:Post
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

async function syncRelationshipGroup({
  relationshipType,
  edges,
  syncId,
}) {
  /*
   * relationshipType is inserted only after validation against
   * the hard-coded allowlist above.
   */
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
    )-[relationship:${relationshipType} {
      graphId: edge.id
    }]->(
      target
    )

    SET relationship.weight =
          edge.weight,
        relationship.metadataJson =
          edge.metadataJson,
        relationship.kind =
          '${relationshipType}',
        relationship.managedBy =
          'treble-sync',
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

async function syncEdges(
  edges,
  syncId
) {
  const grouped =
    new Map();

  edges.forEach(
    (edge) => {
      if (
        !grouped.has(
          edge.relationship
        )
      ) {
        grouped.set(
          edge.relationship,
          []
        );
      }

      grouped
        .get(
          edge.relationship
        )
        .push(edge);
    }
  );

  for (
    const [
      relationshipType,
      relationshipEdges,
    ] of grouped.entries()
  ) {
    for (
      const batch of
      splitIntoBatches(
        relationshipEdges,
        EDGE_BATCH_SIZE
      )
    ) {
      await syncRelationshipGroup({
        relationshipType,
        edges:
          batch,
        syncId,
      });
    }
  }
}

async function removeStaleGraphData(
  syncId
) {
  /*
   * Remove old relationships from both the new native
   * relationship model and the previous generic
   * TREBLE_RELATIONSHIP model.
   */
  const relationshipResult =
    await driver.executeQuery(
      `
      MATCH ()-[
        relationship
      ]->()

      WHERE (
        relationship.managedBy =
          'treble-sync'
        OR type(relationship) =
          'TREBLE_RELATIONSHIP'
      )
      AND (
        relationship.lastSyncId <>
          $syncId
        OR relationship.lastSyncId
          IS NULL
      )

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
        entity
      )

      WHERE entity.managedBy =
          'treble-sync'
      AND (
        entity.lastSyncId <>
          $syncId
        OR entity.lastSyncId
          IS NULL
      )

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

  await syncEdges(
    edges,
    syncId
  );

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

    relationshipTypes:
      [
        ...new Set(
          edges.map(
            (edge) =>
              edge.relationship
          )
        ),
      ].sort(),

    ...cleanup,
  };
}

module.exports = {
  syncGraphToNeo4j,
};
