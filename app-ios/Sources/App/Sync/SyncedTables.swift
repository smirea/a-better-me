import PowerSync

/// The local database PowerSync keeps: every synced table under its server name, as `shared/db/schema.ts` declares
/// them. JSON columns hold JSON text, instants ISO 8601 text, and booleans 0 or 1.
let syncSchema = Schema(
    Table(name: WorkoutTemplate.table, columns: [
        .text("name"),
        .text("notes"),
        .text("blocks"),
        .text("created_at"),
        .text("updated_at"),
    ], ignoreEmptyUpdates: true),
    Table(name: WorkoutSession.table, columns: [
        .text("name"),
        .text("template_id"),
        .text("started_at"),
        .text("ended_at"),
        .text("notes"),
        .text("blocks"),
    ], ignoreEmptyUpdates: true),
    Table(name: CustomExercise.table, columns: [
        .text("exercise"),
        .integer("is_archived"),
    ], ignoreEmptyUpdates: true),
    Table(name: ExerciseSettings.table, columns: [
        .text("pinned_note"),
        .integer("rest_seconds"),
    ], ignoreEmptyUpdates: true),
    Table(name: AppSettings.table, columns: [
        .text("weight_unit"),
        .integer("rest_compound_upper"),
        .integer("rest_compound_lower"),
        .integer("rest_upper_isolation"),
        .integer("rest_lower_isolation"),
        .integer("rest_core"),
    ], ignoreEmptyUpdates: true)
)

extension Schema {
    func columns(of table: String) -> [String] {
        tables.first { $0.name == table }?.columns.map(\.name) ?? []
    }
}
