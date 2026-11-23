import Feedback
import SwiftUI

/// New Supplement and Edit Supplement in one Form: photos the label is read from (the first is its picture), the name
/// and serving, the Supplement Facts per serving, and the regimen that puts it on the Food Log's days.
struct SupplementEditor: View {
    private let editing: Supplement?
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var draft: SupplementDraft
    /// The draft as the editor opened or the last photo read left it, so a new read skips the fields changed since.
    @State private var baseline: SupplementDraft
    private let opened: SupplementDraft
    private let draftKey: String
    @State private var photos = SupplementPhotoReader()
    /// False until every picture it has is in `photos`. Until then `photos` holds only new ones, and a save keeps the
    /// stored ones ahead of them, so a picture still syncing in is never taken for a removed one.
    @State private var picturesLoaded: Bool
    @State private var showErrors = false
    @State private var confirmingDelete = false
    @State private var pickingResume = false
    @FocusState private var focus: SupplementDraft.Field?

    init(supplement: Supplement? = nil) {
        editing = supplement
        let initial = supplement.map { SupplementDraft($0) } ?? SupplementDraft()
        _draft = State(initialValue: initial)
        _baseline = State(initialValue: initial)
        _picturesLoaded = State(initialValue: supplement?.images.isEmpty != false)
        opened = initial
        draftKey = supplement.map { "supplement.\($0.id)" } ?? "supplement.new"
    }

    var body: some View {
        let issues = showErrors ? draft.issues : [:]
        NavigationStack {
            Form {
                PhotosSection(
                    reader: photos,
                    nothingRead: SupplementLabel()
                )
                identity(issues)
                facts(issues)
                regimen(issues)
                ThemedSection("Notes") {
                    TextField("Why you take it, where you buy it", text: $draft.note, axis: .vertical)
                        .lineLimit(2...6)
                        .focused($focus, equals: .note)
                        .accessibilityLabel("Notes")
                }
                if editing != nil {
                    ThemedSection {
                        Button("Delete Supplement", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                            .foregroundStyle(Theme.destructive)
                    }
                }
            }
            .themedList()
            .scrollDismissesKeyboard(.interactively)
            .focusToolbar(draft.focusOrder, focus: $focus)
            .detailTitle(editing != nil ? "Edit Supplement" : "New Supplement")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) {
                        DraftStore.clear(draftKey)
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) { save() }
                }
            }
            .onChange(of: photos.state) {
                guard case let .read(label) = photos.state else { return }
                let read = baseline.reading(label)
                draft.merge(read, over: baseline)
                baseline = read
            }
            .task {
                guard let editing, !picturesLoaded, let stored = await SupplementPictures.complete(editing.images) else { return }
                let uploads = stored.compactMap { PhotoUpload(id: $0.id, jpeg: $0.jpeg) }
                guard uploads.count == stored.count else { return }
                photos.restore(uploads)
                picturesLoaded = true
            }
            .onDisappear { photos.cancel() }
            .sheet(isPresented: $pickingResume) {
                ResumeDaySheet { pauseRegimen(.until($0)) }
            }
            .alert("Delete Supplement", isPresented: $confirmingDelete) {
                Button("Delete", role: .destructive) {
                    if let editing { store.deleteSupplement(editing.id) }
                    DraftStore.clear(draftKey)
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to delete \(draft.name)? It leaves every day it was on. This action cannot be undone.")
            }
        }
        // A read takes seconds and fills the whole label; a stray swipe should not throw that away. Close still does.
        .interactiveDismissDisabled(draft != opened || pictures != editing?.images ?? [])
        .persistDraft($draft, key: draftKey)
        .feedback(self)
    }

    private func identity(_ issues: [SupplementDraft.Field: String]) -> some View {
        ThemedSection("Supplement") {
            HStack(spacing: 12) {
                picture.frame(width: 44, height: 44)
                RowLabel(
                    title: draft.name.isEmpty ? "New Supplement" : draft.name,
                    detail: draft.brand.isEmpty ? "Brand Unknown" : draft.brand
                )
                Spacer()
            }
            TextField("Name", text: $draft.name)
                .focused($focus, equals: .name)
                .accessibilityLabel("Supplement Name")
            FieldIssue(issues[.name])
            TextField("Brand", text: $draft.brand)
                .focused($focus, equals: .brand)
                .accessibilityLabel("Brand")
            TextField("Product Page", text: $draft.url)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focus, equals: .url)
                .accessibilityLabel("Product Page")
            FieldIssue(issues[.url])
            HStack {
                TextField("1", text: $draft.servingQuantity)
                    .keyboardType(.decimalPad)
                    .focused($focus, equals: .servingQuantity)
                    .frame(width: 64)
                    .accessibilityLabel("Serving Quantity")
                Divider()
                TextField("capsule", text: $draft.servingUnit)
                    .textInputAutocapitalization(.never)
                    .focused($focus, equals: .servingUnit)
                    .accessibilityLabel("Serving Unit")
            }
            FieldIssue(issues[.servingQuantity] ?? issues[.servingUnit])
        }
    }

    /// The picture lists will show: the first photo, or the one it has until its photos are loaded.
    @ViewBuilder private var picture: some View {
        if let preview = photos.photos.first?.preview {
            Color.clear
                .overlay { Image(uiImage: preview).resizable().scaledToFill() }
                .clipShape(.rect(cornerRadius: Theme.smallCornerRadius))
                .accessibilityHidden(true)
        } else {
            SupplementPicture(image: picturesLoaded ? nil : editing?.images.first, name: draft.name)
        }
    }

    private func facts(_ issues: [SupplementDraft.Field: String]) -> some View {
        ThemedSection("Supplement Facts", subtitle: "Per serving") {
            ForEach($draft.components) { $component in
                let id = component.id
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        TextField("Ingredient", text: $component.name)
                            .focused($focus, equals: .componentName(id))
                            .accessibilityLabel("Ingredient")
                        TextField("Amount", text: $component.amount)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .focused($focus, equals: .componentAmount(id))
                            .frame(width: 72)
                            .accessibilityLabel("\(component.name) Amount")
                        TextField("unit", text: $component.unit)
                            .textInputAutocapitalization(.never)
                            .focused($focus, equals: .componentUnit(id))
                            .frame(width: 48)
                            .accessibilityLabel("\(component.name) Unit")
                    }
                    FieldIssue(issues[.componentName(id)] ?? issues[.componentAmount(id)])
                }
                .swipeActions {
                    Button("Delete", systemImage: "trash", role: .destructive) { draft.components.removeAll { $0.id == id } }
                }
            }
            Button("Add Ingredient", systemImage: "plus") {
                let added = SupplementDraft.ComponentDraft()
                draft.components.append(added)
                focus = .componentName(added.id)
            }
        }
    }

    private func regimen(_ issues: [SupplementDraft.Field: String]) -> some View {
        let today = CalendarDay.today
        let pause = draft.taking ? draft.regimen.pauses.current(on: today) : nil
        return ThemedSection("Regimen", subtitle: pause.map { SupplementFormat.paused($0, on: today) }) {
            if draft.taking {
                DatePicker("Start", selection: day($draft.regimen.start), displayedComponents: .date)
                HStack {
                    Text("Servings a Day")
                    Spacer()
                    TextField("1", text: $draft.regimen.count)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .focused($focus, equals: .count)
                        .frame(width: 72)
                        .accessibilityLabel("Servings a Day")
                }
                FieldIssue(issues[.count])
                Picker("Time of Day", selection: $draft.regimen.timing) {
                    Text("Any Time").tag(SupplementRegimen.Timing?.none)
                    ForEach(SupplementRegimen.Timing.allCases, id: \.self) { Text($0.title).tag(Optional($0)) }
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text(SupplementFormat.days(draft.regimen.weekdays.sorted()))
                    HStack(spacing: 6) {
                        ForEach(1...7, id: \.self) { weekday in
                            let isOn = draft.regimen.weekdays.contains(weekday)
                            Button {
                                if isOn { draft.regimen.weekdays.remove(weekday) } else { draft.regimen.weekdays.insert(weekday) }
                            } label: {
                                Chip(title: StrategyFormat.weekdayLetters[weekday - 1], isActive: isOn, width: 36)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(StrategyFormat.weekdayNames[weekday - 1])
                            .accessibilityAddTraits(isOn ? .isSelected : [])
                        }
                    }
                    FieldIssue(issues[.weekdays])
                }
                Toggle("End Date", isOn: $draft.regimen.ends.animation()).tint(Theme.accent)
                if draft.regimen.ends {
                    DatePicker("Last Day", selection: day($draft.regimen.end), displayedComponents: .date)
                    FieldIssue(issues[.end])
                }
            }
        } actions: {
            if !draft.taking {
                Button("Start") { withAnimation { draft.taking = true } }
            } else {
                if pause != nil {
                    Button("Resume") { withAnimation { draft.regimen.pauses.resume(on: .today) } }
                } else if draft.regimen.start <= today {
                    Menu("Pause") {
                        Button("Indefinitely") { pauseRegimen(.indefinitely) }
                        Button("1 Week") { pauseRegimen(.week) }
                        Button("Until Next Week") { pauseRegimen(.untilNextWeek) }
                        Button("Custom…") { pickingResume = true }
                    }
                }
                Button("Stop") { withAnimation { draft.taking = false } }
            }
        }
    }

    private func pauseRegimen(_ length: SupplementRegimen.PauseLength) {
        withAnimation { draft.regimen.pauses.pause(length, on: .today) }
    }

    private func day(_ day: Binding<CalendarDay>) -> Binding<Date> {
        Binding { day.wrappedValue.date } set: { day.wrappedValue = CalendarDay($0) }
    }

    /// The pictures a save leaves it with, in order.
    private var pictures: [UUID] {
        (picturesLoaded ? [] : editing?.images ?? []) + photos.photos.map(\.id)
    }

    private func save() {
        showErrors = true
        guard var supplement = draft.supplement(editing: editing) else { return }
        supplement.images = pictures
        store.saveSupplement(supplement, adding: photos.photos.map { NewPicture(id: $0.id, jpeg: $0.jpeg) })
        DraftStore.clear(draftKey)
        dismiss()
    }
}

/// Pause's Custom: the day it is back on.
private struct ResumeDaySheet: View {
    let onPick: (CalendarDay) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var date = CalendarDay.today.adding(days: 1).date

    var body: some View {
        NavigationStack {
            DatePicker("Back On", selection: $date, in: CalendarDay.today.adding(days: 1).date..., displayedComponents: .date)
                .datePickerStyle(.graphical)
                .padding(.horizontal, Theme.margin)
                .detailTitle("Pause Until")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(role: .close) { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(role: .confirm) {
                                onPick(CalendarDay(date))
                            dismiss()
                        }
                    }
                }
        }
        .presentationDetents([.medium, .large])
        .feedback("ResumeDaySheet")
    }
}
