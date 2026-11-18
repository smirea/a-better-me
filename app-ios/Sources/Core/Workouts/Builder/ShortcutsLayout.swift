import Foundation

/// The "+" sheet's Shortcuts, encoded whole into `settings.shortcuts`.
struct ShortcutsLayout: Codable, Hashable {
    var upNextBanner = true
    var top = Shortcut.history
    var items: [Shortcut] = [.weight, .emptyWorkout, .newProgram, .newWorkout]
}

enum Shortcut: String, Codable, CaseIterable {
    case weight, history, emptyWorkout, newProgram, newWorkout
}

extension ShortcutsLayout {
    var topRow: [Shortcut] {
        items.filter { $0.isRound || $0 == top } + (items.contains(top) ? [] : [top])
    }

    var rows: [Shortcut] {
        items.filter { !$0.isRound && $0 != top }
    }

    var hidden: [Shortcut] {
        Shortcut.allCases.filter { !items.contains($0) && $0 != top }
    }

    mutating func setVisible(_ shortcut: Shortcut, _ visible: Bool) {
        items.removeAll { $0 == shortcut }
        if visible { items.append(shortcut) }
    }
}

extension Shortcut {
    var isRound: Bool { self == .weight || self == .history }
}
