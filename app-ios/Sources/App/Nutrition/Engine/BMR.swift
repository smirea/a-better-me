import Foundation

extension NutritionEngine {
    enum Sex {
        case male, female
    }

    /// Basal metabolic rate, the seed of the first expenditure estimate before the dynamic loop has data.
    enum BMR {
        /// The MacroFactor Equation (macrofactor.com/macrofactors-bmr), height and weight form.
        static func macroFactor(weightKg: Double, heightCm: Double, ageYears: Int, sex: Sex) -> Double {
            let ageFactor = ageYears > 60 ? 4.9 : 1.96
            return 129.6 * pow(weightKg, 0.55) + 0.011 * heightCm * heightCm - ageFactor * Double(ageYears) - (sex == .female ? 213.8 : 0)
        }

        /// The MacroFactor Equation, body-composition form.
        static func macroFactor(fatFreeMassKg: Double, fatMassKg: Double, ageYears: Int) -> Double {
            let ageFactor = ageYears > 60 ? 2.75 : 1.1
            let lean = pow(fatFreeMassKg, 0.7)
            return 50.2 * lean + 40.5 * lean * pow(fatMassKg, 0.066) - ageFactor * Double(ageYears)
        }

        /// Cunningham (1991): MacroFactor's other selectable equation.
        static func cunningham(fatFreeMassKg: Double) -> Double {
            21.6 * fatFreeMassKg + 370
        }
    }

    enum ActivityLevel {
        case sedentary, moderatelyActive, veryActive
    }

    enum ExerciseSessions {
        case none, oneToThree, fourToSix, sevenOrMore
    }

    /// The initial expenditure is BMR times an activity factor. MacroFactor publishes the factors only as images;
    /// this table is inferred and anchored on one point: moderately active with 4-6 sessions gave the owner
    /// 1.55 × BMR (within 0.2%). The other cells are guesses spaced like common TDEE calculators.
    enum InitialExpenditure {
        static func estimate(bmr: Double, activity: ActivityLevel, exercise: ExerciseSessions) -> Double {
            let base: Double = switch activity {
            case .sedentary: 1.2
            case .moderatelyActive: 1.4
            case .veryActive: 1.6
            }
            let sessions: Double = switch exercise {
            case .none: 0
            case .oneToThree: 0.075
            case .fourToSix: 0.15
            case .sevenOrMore: 0.225
            }
            return (bmr * (base + sessions)).rounded()
        }
    }
}
