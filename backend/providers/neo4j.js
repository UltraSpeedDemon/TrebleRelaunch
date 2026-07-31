const neo4j = require("neo4j-driver");

const requiredVariables = [
  "NEO4J_URI",
  "NEO4J_USERNAME",
  "NEO4J_PASSWORD",
];

for (const variableName of requiredVariables) {
  if (!process.env[variableName]) {
    throw new Error(
      `[Neo4j] Missing environment variable: ${variableName}`
    );
  }
}

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME,
    process.env.NEO4J_PASSWORD
  )
);

const database =
  process.env.NEO4J_DATABASE || "neo4j";

async function verifyNeo4jConnection() {
  const serverInfo =
    await driver.getServerInfo();

  console.log(
    "[Neo4j] Connected:",
    serverInfo.address
  );

  return serverInfo;
}

async function closeNeo4j() {
  await driver.close();
}

module.exports = {
  driver,
  database,
  verifyNeo4jConnection,
  closeNeo4j,
};
