import Foundation

/// MF's workout and program sheets (research spec milestone-2.md §5.7). The set columns, the superset suffix, and the
/// day cell are shared by both layouts.
enum MFFormat {
    static let workoutSheet = "Workouts"
    static let programSheet = "Training Programs"

    /// `MacroFactor-<yyyyMMddHHmmss>.xlsx`, as MF names both exports.
    static func fileName(at date: Date) -> String {
        "MacroFactor-\(DateFormatter.posix("yyyyMMddHHmmss").string(from: date)).xlsx"
    }

    static let setTypes: [(type: SetType, title: String)] = [
        (.standard, "Standard Set"), (.warmUp, "Warm-Up Set"), (.drop, "Drop Set"), (.myo, "Myo Set"), (.failure, "Failure Set"),
    ]
    static let deloads: [(deload: Deload, title: String)] = [(.none, "None"), (.firstCycle, "First Cycle"), (.lastCycle, "Last Cycle")]
}

/// One library workout in the "Workouts" layout.
enum WorkoutSheet {
    static func worksheet(_ template: WorkoutTemplate, names: [ExerciseID: String], gymName: String?) -> Worksheet {
        let plans = template.blocks.flatMap(\.exercises).map { ($0, $0.sets) }
        let layout = SetLayout(plans)
        var sheet = Worksheet(name: MFFormat.workoutSheet, rows: [
            [Cell(style: .header), .text("Exercise", .header), .text("Notes", .header)] + layout.titles.map { .text($0, .header) },
        ])
        let rows = Rows.members(of: template.blocks, names: names).map { member in
            Rows.exercise(member.exercise, name: member.name, sets: member.exercise.sets, skipped: nil, layout: layout)
        }
        sheet.appendDay(Rows.dayTitle(template.name, gym: gymName), rows: rows)
        sheet.finish()
        return sheet
    }

    /// The first workout in the sheet. `gymID` maps the name after " @ " to a gym profile.
    static func template(from sheet: Worksheet, resolver: inout ExerciseResolver, gymID: (String) -> UUID?) throws -> WorkoutTemplate {
        guard let header = sheet.rows.first else { throw TransferError.malformedRow(1, "The sheet is empty.") }
        let columns = try Columns(header: header, row: 1)
        var template: WorkoutTemplate?
        var day = DayBuilder()
        for (index, row) in sheet.rows.enumerated().dropFirst() {
            let number = index + 1
            let title = Rows.string(row, 0)
            if !title.isEmpty {
                if template != nil { break }
                let (name, gym) = Rows.splitDay(title)
                template = WorkoutTemplate(name: name)
                template?.gymID = gym.flatMap(gymID)
            }
            guard !Rows.string(row, columns.exercise).isEmpty else { continue }
            guard template != nil else { throw TransferError.malformedRow(number, "An exercise comes before the workout's name.") }
            let parsed = try Rows.exercise(from: row, columns: columns, row: number, resolver: &resolver)
            day.add(parsed.exercise, group: parsed.group)
        }
        guard var template else { throw TransferError.malformedRow(2, "The sheet has no workout.") }
        template.blocks = day.blocks
        return template
    }
}

/// One program in the "Training Programs" layout: the header row, `Block 1`, and one section per written cycle.
enum ProgramSheet {
    static func worksheet(_ program: Program, templates: [WorkoutTemplate], names: [ExerciseID: String], gymName: (UUID?) -> String?) -> Worksheet {
        let byID = Dictionary(templates.map { ($0.id, $0) }) { first, _ in first }
        // A day whose template is missing is dropped rather than written as a rest day it never was.
        let days: [WorkoutTemplate?] = program.days.compactMap { day in
            guard let id = day.templateID else { return .some(nil) }
            return byID[id].map { .some($0) }
        }
        let periodized = program.config.periodization
        let cycles = periodized ? program.cycles : 1
        func plan(_ exercise: BlockExercise, cycle: Int) -> (sets: [WorkoutSet], skip: Bool) {
            guard periodized, let targets = exercise.cycleTargets, targets.indices.contains(cycle - 1) else { return (exercise.sets, false) }
            return (targets[cycle - 1].sets, targets[cycle - 1].skip)
        }
        let exercises = days.compactMap(\.self).flatMap(\.blocks).flatMap(\.exercises)
        let layout = SetLayout((1...cycles).flatMap { cycle in exercises.map { ($0, plan($0, cycle: cycle).sets) } })
        let deload = MFFormat.deloads.first { $0.deload == program.config.deload }?.title ?? "None"
        var sheet = Worksheet(name: MFFormat.programSheet, rows: [
            ["Program: \(program.name)", "Cycles: \(program.cycles)", "Deload: \(deload)", "Color: \(program.color.title)", "Icon: \(ProgramIcon.title(of: program.icon))"]
                .map { .text($0, .header) },
            [.text("Block 1")],
        ])
        for cycle in 1...cycles {
            sheet.rows.append([.text("Cycle \(cycle)"), .text("Exercise"), .text("Skipped"), .text("Notes")] + layout.titles.map { .text($0) })
            for template in days {
                guard let template else {
                    sheet.rows.append([.text("Rest")])
                    continue
                }
                let rows = Rows.members(of: template.blocks, names: names).map { member in
                    let (sets, skip) = plan(member.exercise, cycle: cycle)
                    return Rows.exercise(member.exercise, name: member.name, sets: sets, skipped: skip, layout: layout)
                }
                sheet.appendDay(Rows.dayTitle(template.name, gym: gymName(template.gymID)), rows: rows)
            }
        }
        sheet.finish()
        return sheet
    }

    static func program(from sheet: Worksheet, resolver: inout ExerciseResolver, gymID: (String) -> UUID?) throws -> GeneratedProgram {
        var fields: [String: String] = [:]
        for cell in sheet.rows.first ?? [] {
            let parts = Rows.string(cell).split(separator: ":", maxSplits: 1)
            if parts.count == 2, fields[String(parts[0])] == nil { fields[String(parts[0])] = parts[1].trimmingCharacters(in: .whitespaces) }
        }
        guard let name = fields["Program"] else { throw TransferError.malformedRow(1, "The first row has no “Program:” cell.") }
        guard let cycles = fields["Cycles"].flatMap(Int.init), cycles >= 1 else {
            throw TransferError.malformedRow(1, "The first row has no number of cycles.")
        }
        var config = ProgramConfig()
        if let title = fields["Deload"] {
            guard let deload = MFFormat.deloads.first(where: { $0.title.caseInsensitiveCompare(title) == .orderedSame }) else {
                throw TransferError.malformedRow(1, "Unknown deload “\(title)”.")
            }
            config.deload = deload.deload
        }
        let color = fields["Color"].flatMap { title in ProgramColor.allCases.first { $0.title.caseInsensitiveCompare(title) == .orderedSame } } ?? .blue
        let icon = fields["Icon"].flatMap { title in ProgramIcon.all.first { $0.title.caseInsensitiveCompare(title) == .orderedSame }?.symbol }
        var program = Program(name: name, color: color, icon: icon ?? ProgramColor.defaultIcon, cycles: cycles, config: config)

        var templates: [WorkoutTemplate] = []
        // Cycle 1's day cells and exercise names per program day, `nil` for a rest day, which later cycles must repeat.
        var outline: [(day: String, exercises: [String])?] = []
        var builder = DayBuilder()
        var columns: Columns?
        var cycle = 0
        var dayIndex = -1
        var exerciseIndex = 0

        func finishDay(row: Int) throws {
            guard dayIndex >= 0, let day = outline[dayIndex] else { return }
            if cycle == 1 {
                templates[templates.count - 1].blocks = builder.blocks
                builder = DayBuilder()
            } else if exerciseIndex != day.exercises.count {
                throw TransferError.malformedRow(row, "Cycle \(cycle) lists different exercises for “\(day.day)” than cycle 1.")
            }
        }

        func finishCycle(row: Int) throws {
            try finishDay(row: row)
            if cycle > 1, dayIndex != outline.count - 1 {
                throw TransferError.malformedRow(row, "Cycle \(cycle) has different days than cycle 1.")
            }
        }

        func startDay(_ day: (day: String, exercises: [String])?, row: Int) throws {
            try finishDay(row: row)
            dayIndex += 1
            exerciseIndex = 0
            if cycle == 1 {
                outline.append(day)
                if let day {
                    let (name, gym) = Rows.splitDay(day.day)
                    var template = WorkoutTemplate(name: name)
                    template.programID = program.id
                    template.gymID = gym.flatMap(gymID)
                    templates.append(template)
                    program.days.append(ProgramDay(templateID: template.id))
                } else {
                    program.days.append(ProgramDay())
                }
            } else {
                guard outline.indices.contains(dayIndex), outline[dayIndex]?.day == day?.day else {
                    throw TransferError.malformedRow(row, "Cycle \(cycle) has different days than cycle 1.")
                }
            }
        }

        for (index, row) in sheet.rows.enumerated().dropFirst() {
            let number = index + 1
            let first = Rows.string(row, 0)
            if let match = first.wholeMatch(of: #/Block (\d+)/#) {
                guard match.1 == "1" else { throw TransferError.malformedRow(number, "Only a program with one block can be imported.") }
                continue
            }
            if let match = first.wholeMatch(of: #/Cycle (\d+)/#) {
                try finishCycle(row: number)
                guard Int(match.1) == cycle + 1 else { throw TransferError.malformedRow(number, "Expected cycle \(cycle + 1), found “\(first)”.") }
                cycle += 1
                dayIndex = -1
                columns = try Columns(header: row, row: number)
                continue
            }
            guard let columns else {
                if row.allSatisfy({ $0.value == nil }) { continue }
                throw TransferError.malformedRow(number, "A row comes before the first cycle.")
            }
            let exerciseName = Rows.string(row, columns.exercise)
            if first == "Rest" && exerciseName.isEmpty {
                try startDay(nil, row: number)
                continue
            }
            if !first.isEmpty { try startDay((first, []), row: number) }
            guard !exerciseName.isEmpty else { continue }
            guard dayIndex >= 0, outline[dayIndex] != nil else { throw TransferError.malformedRow(number, "An exercise comes before its day's name.") }
            if cycle == 1 {
                let parsed = try Rows.exercise(from: row, columns: columns, row: number, resolver: &resolver)
                var exercise = parsed.exercise
                exercise.cycleTargets = [CycleTargets(sets: exercise.sets, skip: parsed.skipped)]
                builder.add(exercise, group: parsed.group)
                outline[dayIndex]?.exercises.append(exerciseName)
            } else {
                guard let day = outline[dayIndex], exerciseIndex < day.exercises.count, day.exercises[exerciseIndex] == exerciseName else {
                    throw TransferError.malformedRow(number, "Cycle \(cycle) lists different exercises than cycle 1.")
                }
                let targets = CycleTargets(sets: try Rows.sets(from: row, columns: columns, row: number), skip: try Rows.skipped(row, columns: columns, row: number))
                let template = program.days[..<dayIndex].count { $0.templateID != nil }
                let position = Rows.position(exerciseIndex, in: templates[template].blocks)
                templates[template].blocks[position.block].exercises[position.exercise].cycleTargets?.append(targets)
                exerciseIndex += 1
            }
        }
        guard cycle > 0 else { throw TransferError.malformedRow(sheet.rows.count, "The sheet has no cycles.") }
        try finishCycle(row: sheet.rows.count)

        program.config.periodization = cycle > 1
        if cycle == 1 {
            for t in templates.indices {
                for b in templates[t].blocks.indices {
                    for e in templates[t].blocks[b].exercises.indices { templates[t].blocks[b].exercises[e].cycleTargets = nil }
                }
            }
        }
        return GeneratedProgram(program: program, templates: templates)
    }
}

/// The set columns one header row names, so a file with reordered columns still reads.
private struct Columns {
    enum Field: String, CaseIterable {
        case type = "Type", repRange = "Rep Range", rir = "RIR", rest = "Rest", duration = "Duration", distance = "Distance"
    }

    var exercise: Int
    var notes: Int?
    var skipped: Int?
    var sets: [[Field: Int]]

    init(header: [Cell], row: Int) throws {
        var named: [String: Int] = [:]
        var sets: [Int: [Field: Int]] = [:]
        for (column, cell) in header.enumerated() {
            let title = Rows.string(cell)
            if let match = title.wholeMatch(of: #/Set\s+(\d+)\s+(Type|Rep Range|RIR|Rest|Duration|Distance)/#), let number = Int(match.1) {
                sets[number, default: [:]][Field(rawValue: String(match.2))!] = column
            } else if named[title] == nil {
                named[title] = column
            }
        }
        guard let exercise = named["Exercise"] else { throw TransferError.malformedRow(row, "The header has no “Exercise” column.") }
        self.exercise = exercise
        notes = named["Notes"]
        skipped = named["Skipped"]
        self.sets = sets.sorted { $0.key < $1.key }.map(\.value)
    }
}

/// How many set columns a sheet has, and whether it carries `Set N Duration`. MF pads every row to the widest.
private struct SetLayout {
    var count: Int
    var duration: Bool

    init(_ plans: [(BlockExercise, [WorkoutSet])]) {
        count = plans.map(\.1.count).max() ?? 0
        duration = plans.contains { $0.1.contains { $0.target?.durationSeconds != nil } }
    }

    var titles: [String] {
        guard count > 0 else { return [] }
        return (1...count).flatMap { n in
            ["Set \(n) Type", "Set \(n) Rep Range", "Set \(n) RIR", "Set \(n) Rest"] + (duration ? ["Set \(n) Duration"] : [])
        }
    }
}

/// Folds exercise rows into blocks: consecutive rows with the same " ∈ SSn" suffix are one superset.
private struct DayBuilder {
    var blocks: [WorkoutBlock] = []
    private var group: String?

    mutating func add(_ exercise: BlockExercise, group: String?) {
        if let group, group == self.group {
            blocks[blocks.count - 1].exercises.append(exercise)
        } else {
            blocks.append(WorkoutBlock(exercises: [exercise]))
        }
        self.group = group
    }
}

private enum Rows {
    static func members(of blocks: [WorkoutBlock], names: [ExerciseID: String]) -> [(exercise: BlockExercise, name: String)] {
        var group = 0
        return blocks.flatMap { block in
            if block.isSuperset { group += 1 }
            let suffix = block.isSuperset ? " ∈ SS\(group)" : ""
            return block.exercises.map { ($0, (names[$0.exerciseID] ?? "Unknown exercise") + suffix) }
        }
    }

    static func position(_ index: Int, in blocks: [WorkoutBlock]) -> (block: Int, exercise: Int) {
        var rest = index
        for (block, contents) in blocks.enumerated() {
            if rest < contents.exercises.count { return (block, rest) }
            rest -= contents.exercises.count
        }
        preconditionFailure("Exercise \(index) is past the day's end")
    }

    static func dayTitle(_ name: String, gym: String?) -> String { gym.map { "\(name) @ \($0)" } ?? name }

    static func splitDay(_ title: String) -> (name: String, gym: String?) {
        guard let at = title.range(of: " @ ", options: .backwards) else { return (title, nil) }
        return (String(title[..<at.lowerBound]), String(title[at.upperBound...]))
    }

    /// Cells B onward of an exercise row: the name, `Skipped` in a program, the note, and the set columns.
    static func exercise(_ exercise: BlockExercise, name: String, sets: [WorkoutSet], skipped: Bool?, layout: SetLayout) -> [Cell] {
        var cells: [Cell] = [.text(name)]
        if let skipped { cells.append(.text(skipped ? "Yes" : "No")) }
        cells.append(exercise.note.flatMap { $0.isEmpty ? nil : Cell.text($0) } ?? .empty)
        for set in sets {
            let rest = (set.restSeconds ?? exercise.restSeconds).map { Cell.number(Double($0)) } ?? .empty
            cells += [.text(MFFormat.setTypes.first { $0.type == set.type }!.title), repRange(set), rir(set), rest]
            if layout.duration { cells.append(set.target?.durationSeconds.map { .number(Double($0)) } ?? .empty) }
        }
        return cells
    }

    /// "8 - 12", "10 - 10", a failure set's "8+", and a drop or myo set's sub-rows in parentheses: "8 - 8 (6 - 6)".
    private static func repRange(_ set: WorkoutSet) -> Cell {
        func reps(_ target: SetTarget?, failure: Bool) -> String {
            switch (target?.repsMin, target?.repsMax) {
            case let (min?, max?): failure ? "\(min)+" : "\(min) - \(max)"
            case let (min?, nil): "\(min)+"
            case let (nil, max?): "\(max)"
            case (nil, nil): ""
            }
        }
        let text = ([reps(set.target, failure: set.type == .failure)] + subSets(of: set).map { "(\(reps($0.target, failure: false)))" })
            .joined(separator: " ").trimmingCharacters(in: .whitespaces)
        return text.isEmpty ? .empty : .text(text)
    }

    /// A decimal number cell, or text such as "0 (0)" when the set has sub-rows, each sharing the set's RIR unless it
    /// has its own.
    private static func rir(_ set: WorkoutSet) -> Cell {
        let rir = set.target?.rir
        let subs = subSets(of: set)
        guard !subs.isEmpty else { return rir.map { .number(Double($0)) } ?? .empty }
        let values = [rir] + subs.map { $0.target?.rir ?? rir }
        guard values.contains(where: { $0 != nil }) else { return .empty }
        let text = ([values[0].map(String.init) ?? ""] + values.dropFirst().map { "(\($0.map(String.init) ?? ""))" }).joined(separator: " ")
        return .text(text.trimmingCharacters(in: .whitespaces))
    }

    private static func subSets(of set: WorkoutSet) -> [SubSet] { set.type.hasSubSets ? set.subSets : [] }

    static func exercise(from row: [Cell], columns: Columns, row number: Int, resolver: inout ExerciseResolver)
        throws -> (exercise: BlockExercise, group: String?, skipped: Bool) {
        let label = string(row, columns.exercise)
        var name = label
        var group: String?
        if let match = label.wholeMatch(of: #/(.*) ∈ (SS\d+)/#) {
            name = String(match.1)
            group = String(match.2)
        }
        let note = string(row, columns.notes)
        let exercise = BlockExercise(
            exerciseID: resolver.id(for: name),
            sets: try sets(from: row, columns: columns, row: number),
            note: note.isEmpty ? nil : note
        )
        return (exercise, group, try skipped(row, columns: columns, row: number))
    }

    static func skipped(_ row: [Cell], columns: Columns, row number: Int) throws -> Bool {
        switch string(row, columns.skipped).lowercased() {
        case "yes": return true
        case "no", "": return false
        case let other: throw TransferError.malformedRow(number, "Skipped is “\(other)”, not Yes or No.")
        }
    }

    static func sets(from row: [Cell], columns: Columns, row number: Int) throws -> [WorkoutSet] {
        try columns.sets.compactMap { set in try self.set(from: row, columns: set, row: number) }
    }

    private static func set(from row: [Cell], columns: [Columns.Field: Int], row number: Int) throws -> WorkoutSet? {
        let title = string(row, columns[.type])
        guard !title.isEmpty else { return nil }
        guard let type = MFFormat.setTypes.first(where: { $0.title.caseInsensitiveCompare(title) == .orderedSame })?.type else {
            throw TransferError.malformedRow(number, "Unknown set type “\(title)”.")
        }
        let reps = try parts(of: string(row, columns[.repRange])).map { try $0.isEmpty ? nil : repRange($0, row: number) }
        let rirs: [Int?] = switch cell(row, columns[.rir])?.value {
        case .number(let value): [Int(value.rounded())]
        case .text(let text): try parts(of: text).map { try $0.isEmpty ? nil : integer($0.replacing("+", with: ""), row: number) }
        case nil: []
        }
        let rest = try seconds(row, columns[.rest], row: number)
        let duration = try seconds(row, columns[.duration], row: number)
        let main = target(reps.first ?? nil, rir: rirs.first ?? nil, duration: duration)
        var set = WorkoutSet(type: type, target: main, restSeconds: rest)
        if type.hasSubSets {
            let count = max(reps.count, rirs.count)
            set.subSets = count < 2 ? [] : (1..<count).map { index in
                let rir = rirs.indices.contains(index) ? rirs[index] : nil
                return SubSet(target: target(reps.indices.contains(index) ? reps[index] : nil, rir: rir ?? main?.rir, duration: nil))
            }
        }
        return set
    }

    private static func target(_ reps: (min: Int, max: Int?)?, rir: Int?, duration: Int?) -> SetTarget? {
        guard reps != nil || rir != nil || duration != nil else { return nil }
        return SetTarget(repsMin: reps?.min, repsMax: reps?.max, rir: rir, durationSeconds: duration)
    }

    /// "8 - 8 (6 - 6) (4 - 4)" or "8 - 8 (6 - 6, 4 - 4)" to ["8 - 8", "6 - 6", "4 - 4"].
    private static func parts(of text: String) -> [String] {
        guard !text.isEmpty else { return [] }
        let head = text.prefix { $0 != "(" }.trimmingCharacters(in: .whitespaces)
        let groups = text.matches(of: #/\(([^)]*)\)/#).flatMap { $0.1.split(separator: ",", omittingEmptySubsequences: false) }
        return [head] + groups.map { $0.trimmingCharacters(in: .whitespaces) }
    }

    private static func repRange(_ text: String, row: Int) throws -> (min: Int, max: Int?) {
        if let match = text.wholeMatch(of: #/(\d+)\s*-\s*(\d+)/#) { return (Int(match.1)!, Int(match.2)!) }
        if let match = text.wholeMatch(of: #/(\d+)\s*\+/#) { return (Int(match.1)!, nil) }
        if let value = Int(text) { return (value, value) }
        throw TransferError.malformedRow(row, "“\(text)” is not a rep range.")
    }

    private static func integer(_ text: String, row: Int) throws -> Int {
        guard let value = Double(text.trimmingCharacters(in: .whitespaces)) else { throw TransferError.malformedRow(row, "“\(text)” is not a number.") }
        return Int(value.rounded())
    }

    /// A number cell of seconds, or text as seconds or "m:ss".
    private static func seconds(_ row: [Cell], _ column: Int?, row number: Int) throws -> Int? {
        switch cell(row, column)?.value {
        case .number(let value): return Int(value.rounded())
        case .text(let text):
            let text = text.trimmingCharacters(in: .whitespaces)
            if text.isEmpty { return nil }
            if let match = text.wholeMatch(of: #/(\d+):(\d{2})/#) { return Int(match.1)! * 60 + Int(match.2)! }
            return try integer(text, row: number)
        case nil: return nil
        }
    }

    private static func cell(_ row: [Cell], _ column: Int?) -> Cell? {
        guard let column, row.indices.contains(column) else { return nil }
        return row[column]
    }

    static func string(_ row: [Cell], _ column: Int?) -> String { cell(row, column).map(string) ?? "" }

    static func string(_ cell: Cell) -> String {
        switch cell.value {
        case .text(let text): text.trimmingCharacters(in: .whitespaces)
        case .number(let number): number.rounded() == number ? String(Int(number)) : String(number)
        case nil: ""
        }
    }
}

private extension Worksheet {
    /// A day's rows with the title in column A on the first, and column A merged down the rest as MF does.
    mutating func appendDay(_ title: String, rows: [[Cell]]) {
        let first = self.rows.count + 1
        let rows = rows.isEmpty ? [[]] : rows
        for (index, cells) in rows.enumerated() {
            self.rows.append([index == 0 ? .text(title, .dayName) : Cell(style: .dayName)] + cells)
        }
        if rows.count > 1 { mergedRows.append(first...(first + rows.count - 1)) }
    }

    /// Pads every row to the widest with blank cells (bold on the header row) and sizes the columns to their text.
    mutating func finish() {
        let width = rows.map(\.count).max() ?? 0
        rows = rows.enumerated().map { index, row in
            row + Array(repeating: Cell(style: index == 0 ? .header : .plain), count: width - row.count)
        }
        columnWidths = [:]
        for column in 0..<width {
            let longest = rows.map { $0[column].value.map { Rows.string(Cell(value: $0)).count } ?? 0 }.max() ?? 0
            if longest > 0 { columnWidths[column + 1] = min(Double(longest) * 1.1 + 2, 80) }
        }
    }
}
