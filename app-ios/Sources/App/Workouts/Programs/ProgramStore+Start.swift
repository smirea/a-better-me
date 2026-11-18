import Foundation

extension LocalStore {
    /// Starts a program day as a session of the current cycle, through the one-session-at-a-time prompt.
    func startProgramDay(_ program: Program, template: WorkoutTemplate, presenter: LiveWorkoutPresenter) {
        guard let day = program.day(for: template.id) else { return }
        presenter.startOrResume({ program.session(startingFrom: template, dayID: day.id, gymID: template.gymID) }, in: self)
    }
}
