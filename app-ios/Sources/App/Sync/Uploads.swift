import Foundation
import PowerSync

/// One queued write as `POST /api/upload` takes it. `values` are PowerSync's columns as the server reads them:
/// snake_case names, JSON columns as JSON text, numbers as numbers.
struct RowWrite: Equatable {
    enum Op: String { case put, patch, delete }

    var op: Op
    var table: String
    var id: String
    var values: [String: JsonValue]?
    var opId: String

    var wire: JsonValue {
        var fields: [String: JsonValue] = [
            "op": .string(op.rawValue), "table": .string(table), "id": .string(id), "opId": .string(opId),
        ]
        if let values { fields["values"] = .object(values) }
        return .object(fields)
    }
}

enum Uploads {
    /// A queued entry as a row write. PowerSync leaves null columns out of a put, and the server reads a put as the
    /// whole row, so the missing columns are sent as null.
    static func write(_ entry: CrudEntry, databaseID: String) -> RowWrite {
        let op: RowWrite.Op = switch entry.op {
        case .put: .put
        case .patch: .patch
        case .delete: .delete
        }
        var values = entry.opDataTyped ?? [:]
        if op == .put {
            for column in syncSchema.columns(of: entry.table) where values[column] == nil {
                values[column] = .null
            }
        }
        return RowWrite(op: op, table: entry.table, id: entry.id, values: op == .delete ? nil : values, opId: "\(databaseID):\(entry.clientId)")
    }

    /// Folds writes to one row into one: a patch folds into the write before it, keeping that write's place, later
    /// fields winning. A put or a delete replaces what came before and moves to its own place. A patch after a delete
    /// changes nothing.
    static func coalesce(_ writes: [RowWrite]) -> [RowWrite] {
        var out: [RowWrite?] = []
        var at: [String: Int] = [:]
        for write in writes {
            let key = "\(write.table):\(write.id)"
            let index = at[key]
            if let index, let prior = out[index], write.op == .patch {
                if prior.op != .delete {
                    out[index]?.values = (prior.values ?? [:]).merging(write.values ?? [:]) { _, later in later }
                }
                continue
            }
            if let index { out[index] = nil }
            out.append(write)
            at[key] = out.count - 1
        }
        return out.compactMap(\.self)
    }
}
