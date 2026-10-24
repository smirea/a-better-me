import PowerSync

/// The local database PowerSync keeps: every synced table under its server name, as `shared/db/schema.ts` declares
/// them. JSON columns hold JSON text, instants ISO 8601 text, booleans 0 or 1, and `weight_kg` a REAL.
let syncSchema = Schema(
    Table(name: WorkoutTemplate.table, columns: [
        .text("name"),
        .text("notes"),
        .text("blocks"),
        .text("program_id"),
        .text("gym_id"),
        .integer("archived"),
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
        .text("program_id"),
        .text("program_day_id"),
        .integer("cycle"),
        .text("gym_id"),
        .integer("paused_seconds"),
    ], ignoreEmptyUpdates: true),
    Table(name: CustomExercise.table, columns: [
        .text("exercise"),
        .integer("is_archived"),
    ], ignoreEmptyUpdates: true),
    Table(name: ExerciseSettings.table, columns: [
        .text("pinned_note"),
        .integer("rest_seconds"),
        .integer("do_not_recommend"),
        .text("overrides"),
    ], ignoreEmptyUpdates: true),
    Table(name: AppSettings.table, columns: [
        .text("weight_unit"),
        .integer("rest_compound_upper"),
        .integer("rest_compound_lower"),
        .integer("rest_upper_isolation"),
        .integer("rest_lower_isolation"),
        .integer("rest_core"),
        .text("workout"),
        .text("profile"),
        .text("dashboard"),
        .text("shortcuts"),
    ], ignoreEmptyUpdates: true),
    Table(name: Program.table, columns: [
        .text("name"),
        .text("color"),
        .text("icon"),
        .integer("cycles"),
        .integer("current_cycle"),
        .integer("active"),
        .integer("archived"),
        .text("config"),
        .text("days"),
        .text("created_at"),
        .text("updated_at"),
    ], ignoreEmptyUpdates: true),
    Table(name: GymProfile.table, columns: [
        .text("name"),
        .text("icon"),
        .integer("is_default"),
        .text("equipment"),
        .text("created_at"),
        .text("updated_at"),
    ], ignoreEmptyUpdates: true),
    Table(name: BodyWeight.table, columns: [
        .text("measured_at"),
        .real("weight_kg"),
        .text("source"),
    ], ignoreEmptyUpdates: true)
)

extension Schema {
    func columns(of table: String) -> [String] {
        tables.first { $0.name == table }?.columns.map(\.name) ?? []
    }
}
