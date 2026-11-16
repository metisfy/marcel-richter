import "server-only";

import { ObjectId } from "mongodb";

import type { ContactTopic } from "@/lib/contact-shared";

import { database } from "./db";

/*
 * Nachrichten aus dem Kontaktformular (Sammlung `nachrichten`). Sie landen
 * hier zusätzlich zur Mail – so geht auch ohne Mailversand nichts verloren.
 * Ein TTL-Index löscht sie nach spätestens 12 Monaten (db.ts, Datenschutz).
 */

type MessageDoc = {
  _id: ObjectId;
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
  locale: string;
  receivedAt: Date;
  read: boolean;
  mailed: boolean;
};

export type Message = Omit<MessageDoc, "_id"> & { id: string };

const collection = async () => (await database()).collection<MessageDoc>("nachrichten");
const toMessage = ({ _id, ...rest }: MessageDoc): Message => ({ id: _id.toHexString(), ...rest });

export async function storeMessage(input: Omit<MessageDoc, "_id" | "receivedAt" | "read" | "mailed">): Promise<string> {
  const result = await (await collection()).insertOne({ ...input, receivedAt: new Date(), read: false, mailed: false } as MessageDoc);
  return result.insertedId.toHexString();
}

export async function markMailed(id: string): Promise<void> {
  if (ObjectId.isValid(id)) await (await collection()).updateOne({ _id: new ObjectId(id) }, { $set: { mailed: true } });
}

export async function listMessages(limit = 200): Promise<Message[]> {
  return (await (await collection()).find({}).sort({ receivedAt: -1 }).limit(limit).toArray()).map(toMessage);
}

export async function messageById(id: string): Promise<Message | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await (await collection()).findOne({ _id: new ObjectId(id) });
  return doc ? toMessage(doc) : null;
}

export async function countUnread(): Promise<number> {
  return (await collection()).countDocuments({ read: false });
}

export async function setRead(id: string, read: boolean): Promise<void> {
  if (ObjectId.isValid(id)) await (await collection()).updateOne({ _id: new ObjectId(id) }, { $set: { read } });
}

export async function deleteMessage(id: string): Promise<void> {
  if (ObjectId.isValid(id)) await (await collection()).deleteOne({ _id: new ObjectId(id) });
}
