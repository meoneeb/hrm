import type { Document } from "mongoose";

export function serialize<T extends Record<string, unknown>>(doc: Document | T) {
  const raw =
    typeof (doc as Document).toObject === "function"
      ? (doc as Document).toObject({ virtuals: true })
      : { ...doc };

  const obj = raw as Record<string, unknown>;
  if (obj._id) obj.id = String(obj._id);
  delete obj._id;
  delete obj.__v;
  delete obj.passHash;

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
      if ("_bsontype" in (val as object) || (val as { buffer?: unknown }).buffer) {
        obj[key] = String(val);
      }
    } else if (Array.isArray(val)) {
      obj[key] = val.map((item) => {
        if (item && typeof item === "object" && "_id" in item) {
          return serialize(item as Record<string, unknown>);
        }
        if (item && typeof item === "object" && ("_bsontype" in item || "buffer" in item)) {
          return String(item);
        }
        return item;
      });
    } else if (val instanceof Date) {
      obj[key] = val.toISOString();
    } else if (val && typeof val === "object" && ("_bsontype" in (val as object) || "buffer" in (val as object))) {
      obj[key] = String(val);
    }
  }
  return obj;
}

export function serializeMany(docs: Array<Document | Record<string, unknown>>) {
  return docs.map((d) => serialize(d));
}
