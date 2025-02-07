import { MongoClient } from "mongodb";
import { MONGO_URI } from "@env";

export const connectToMongo = async () => {
    const client = new MongoClient(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        return client;
    } catch (error) {
        console.error(error);
    }
    }

export const getCollection = async (client, collectionName) => {
    return client.db("Treble").collection(collectionName);
    }

export const findDocuments = async (collection, query) => {
    return collection.find(query).toArray();
    }

export const findOneDocument = async (collection, query) => {
    return collection
    .findOne(query)
    .then((doc) => {
        return doc;
    })
    .catch((error) => {
        console.error(error);
    });
    }

export const insertDocument = async (collection, document) => {
    return collection.insertOne(document);
    }

export const updateDocument = async (collection, query, update) => {
    return
    collection
    .update
    .findOne
    .update
    .catch
    }


export const deleteDocument = async (collection, query) => {
    return collection.deleteOne(query);
    }

export const closeConnection = async (client) => {
    return client.close();
    }
