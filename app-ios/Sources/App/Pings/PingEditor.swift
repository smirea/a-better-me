import Feedback
import SwiftUI

/// New Ping and Edit Ping in one form: the name, the color and icon, whether it is a boolean or a range, and a range's
/// steps with an optional label each. A new ping starts on a swatch no other ping uses. Until the owner picks a color or
/// an icon, the on-device model picks it from the name as they type; a pick of theirs always wins.
struct PingEditor: View {
    private enum Kind: String, CaseIterable {
        case boolean = "Boolean", range = "Range"
    }

    private let editing: Ping?
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    /// The owner's pick, or the ping's own; nil until one exists, while the suggestion shows.
    @State private var icon: String?
    @State private var color: PingColor?
    @State private var suggestion: PingLook?
    @State private var kind: Kind
    /// Kept at the most steps a range can have, so labels survive lowering and raising the count.
    @State private var labels: [String]
    @State private var stepCount: Int
    @State private var confirmingDelete = false
    @FocusState private var nameFocused: Bool
    @Observe private var isLogged: Bool
    @Observe(Ping.all) private var pings

    init(ping: Ping? = nil) {
        editing = ping
        _isLogged = Observe(PingLog.exists(for: ping?.id))
        let steps = ping?.kind.steps ?? []
        _name = State(initialValue: ping?.name ?? "")
        _icon = State(initialValue: ping?.icon)
        _color = State(initialValue: ping?.color)
        _kind = State(initialValue: steps.isEmpty ? .boolean : .range)
        _stepCount = State(initialValue: steps.isEmpty ? 5 : steps.count)
        _labels = State(initialValue: steps + Array(repeating: "", count: PingKind.stepLimits.upperBound - steps.count))
    }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// The swatches no other ping uses, every swatch once all are taken: the default, and what the model picks from.
    private var openColors: [PingColor] {
        let others = pings.filter { $0.id != editing?.id }
        let used = Set(others.map { $0.color ?? .fallback })
        let open = PingColor.allCases.filter { !used.contains($0) }
        return open.isEmpty ? PingColor.allCases : open
    }

    private var shownIcon: String { icon ?? suggestion?.icon ?? PingIcons.all[0] }

    private var shownColor: PingColor {
        color ?? suggestion?.color ?? PingColor.unused(by: pings.filter { $0.id != editing?.id })
    }

    var body: some View {
        NavigationStack {
            Form {
                // The owner asked (2026-11-19) for the name and type without a card, using the card's padding for them.
                Section {
                    TextField("Name", text: $name)
                        .font(AppFont.title(24))
                        .focused($nameFocused)
                        .accessibilityLabel("Ping Name")
                    Picker("Type", selection: $kind) {
                        ForEach(Kind.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .disabled(isLogged)
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                ThemedSection("Color") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 6), spacing: 12) {
                        ForEach(PingColor.allCases, id: \.self) { swatch in
                            Button { color = swatch } label: {
                                Circle()
                                    .fill(swatch.swatch)
                                    .frame(width: 32, height: 32)
                                    .overlay { if swatch == shownColor { Circle().strokeBorder(Theme.textPrimary, lineWidth: 2.5).padding(-5) } }
                                    .frame(width: 44, height: 44)
                                    .contentShape(.rect)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(swatch.title)
                            .accessibilityAddTraits(swatch == shownColor ? .isSelected : [])
                        }
                    }
                    .padding(.vertical, 4)
                }
                ThemedSection("Icon") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 4) {
                        ForEach(PingIcons.all, id: \.self) { symbol in
                            let isShown = symbol == shownIcon
                            Button { icon = symbol } label: {
                                Image(systemName: symbol)
                                    .font(.system(size: 17, weight: .semibold))
                                    .foregroundStyle(isShown ? Theme.onPrimary : Theme.textPrimary)
                                    .frame(width: 38, height: 38)
                                    .background(isShown ? shownColor.swatch : Color.clear, in: .circle)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(symbol)
                            .accessibilityAddTraits(isShown ? .isSelected : [])
                        }
                    }
                }
                if kind == .range {
                    ThemedSection("Steps") {
                        if isLogged {
                            Text("\(stepCount) steps")
                        } else {
                            Stepper("\(stepCount) steps", value: $stepCount, in: PingKind.stepLimits)
                        }
                        ForEach(0..<stepCount, id: \.self) { index in
                            HStack(spacing: 12) {
                                Text("\(index + 1)").font(AppFont.number(15)).foregroundStyle(Theme.textSecondary).frame(width: 24)
                                TextField("Label", text: $labels[index]).accessibilityLabel("Step \(index + 1) label")
                            }
                        }
                    }
                }
                if editing != nil {
                    ThemedSection {
                        Button("Delete Ping", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                            .foregroundStyle(Theme.destructive)
                    }
                }
            }
            .flatList()
            .contentMargins(.top, 0, for: .scrollContent)
            .scrollDismissesKeyboard(.interactively)
            .detailTitle(editing != nil ? "Edit Ping" : "New Ping")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) { save() }.disabled(trimmedName.isEmpty)
                }
            }
            .alert("Delete Ping", isPresented: $confirmingDelete) {
                Button("Delete", role: .destructive) {
                    if let editing { store.deletePing(editing.id) }
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Everything logged for it goes too.")
            }
            .onAppear { nameFocused = editing == nil }
            .task(id: trimmedName) { await suggest() }
        }
        .feedback(self)
    }

    private func save() {
        let steps = labels.prefix(stepCount).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        var ping = editing ?? Ping(name: "", icon: shownIcon, kind: .boolean)
        ping.name = trimmedName
        ping.icon = shownIcon
        ping.color = shownColor
        ping.kind = kind == .range ? .range(steps) : .boolean
        store.savePing(ping)
        dismiss()
    }

    /// Asks the model once the name rests for a moment, and only while the color or the icon is still unpicked.
    private func suggest() async {
        let model = PingLookModel()
        guard !trimmedName.isEmpty, icon == nil || color == nil, model.isAvailable else { return }
        do {
            try await Task.sleep(for: .milliseconds(400))
        } catch {
            return
        }
        let look = await model.look(for: trimmedName, colors: openColors)
        guard !Task.isCancelled, let look else { return }
        withAnimation(.snappy) { suggestion = look }
    }
}

/// The symbols a ping can take, grouped loosely: feelings, body, food and drink, activity, and the rest.
enum PingIcons {
    static let all = [
        "face.smiling", "heart", "brain.head.profile", "bolt", "battery.75percent", "moon.zzz", "bed.double",
        "drop", "cup.and.saucer", "wineglass", "fork.knife", "pills", "cross.case", "toilet",
        "figure.walk", "figure.run", "figure.mind.and.body", "dumbbell", "lungs", "thermometer.medium", "bandage",
        "sun.max", "cloud.rain", "leaf", "flame", "snowflake", "eye", "ear",
        "book", "gamecontroller", "tv", "iphone", "briefcase", "house", "car",
        "person.2", "pawprint", "shower", "sparkles", "star", "checkmark.circle", "circle",
    ]
}
