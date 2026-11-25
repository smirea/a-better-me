# How the muscle numbers are computed

`src/biomech.ts` turns an animated rep into how hard each of the app's 23 muscle groups works at each frame, and `src/muscles.ts` holds how strong each group is. This page says what the model does, where each rule and number comes from, how its output compares with measured muscle activity, and where it is still crude.

## The model

1. **Known forces.** Gravity on each body segment (Winter's segment masses and centres of mass), each segment's mass times its linear acceleration, and the loads a spec lists: a weight at an anchor, a cable pulling toward its pulley, or a push in a fixed direction. Accelerations are low-passed near 1 Hz, with no lag. Rotational inertia is left out, which costs about 2 N·m against hip moments of 100 to 300 N·m at lifting tempo.
2. **Contact forces.** A floor, a footplate or a fixed handle pushes back with whatever balance needs, so a spec lists what the body touches (`support.contacts`), never how much each contact carries. Each contact point pushes inside a friction cone about its surface's normal and stops carrying as it lifts off. Whole-body balance of force and moment fixes what it can. Where balance leaves a choice (how hard the feet press sideways, where under a foot the pressure sits, how two hands share a bar) the lifter takes the one that costs the muscles least. A seat, bench or pad that carries the pelvis takes whatever is left over.
3. **Joint torques.** Each joint's torque is the moment of every force beyond it (inverse dynamics), read along that joint's anatomical axes.
4. **Muscle effort.** Each muscle group is a set of torque generators: its peak torque at each joint motion it produces, scaled by a strength curve against joint angle and by a force-velocity factor. A head that crosses two joints (hamstrings, rectus femoris, gastrocnemius, the long heads of biceps and triceps, the pecs across the shoulder girdle) pulls on both at once. Activations between 0 and 1 are chosen to meet every joint's torque with the least total squared activation, together with the contact forces, as one bounded least-squares problem solved exactly. Its answer is unique and moves continuously with the pose, so neighbouring frames cannot disagree about which muscle works.
5. **Co-contraction.** Antagonists give back a tenth of the net torque at each joint. The level is set from the torque, not from a sign test, so it fades to nothing as a torque passes through zero.
6. **Stretch and tendons.** Each group's length is a linear function of the joint angles it crosses, read from 0 at standing length to 1 at the end of the joint's passive range. Passive tension starts at 60% stretch. Tendon load is active plus passive force, with 4.9% strain at peak isometric force.

## Where the rules come from

| Rule | Source |
|---|---|
| Inverse dynamics from segment weights, accelerations and external forces | [OpenSim: How Inverse Dynamics Works](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53090079/How+Inverse+Dynamics+Works) |
| Static optimisation: least total squared activation, each frame on its own | Anderson & Pandy 2001 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/11165278/)); [OpenSim: How Static Optimization Works](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089619/How+Static+Optimization+Works) |
| Contact forces solved with the muscles, by least effort | Fluit et al. 2014 ([University of Twente](https://research.utwente.nl/en/publications/prediction-of-ground-reaction-forces-and-moments-during-various-a/)); Skals et al. 2017 ([Aalborg University](https://vbn.aau.dk/ws/files/239847501/SkalsEtAl_2016_MSD_Combined_Accepted.pdf)) |
| Per-frame optimisation can jump between frames unless its inputs are smooth and its answer unique | Thelen & Anderson 2006 ([preprint](https://uwnmbl.engr.wisc.edu/pubs/jb05_preprint.pdf)); De Groote et al. 2016 ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5043004/)) |
| Antagonists hold a roughly constant opposing torque, about a tenth of a maximal effort | Aagaard et al. 2000 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/10755275/)); Kellis & Baltzopoulos 1997 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/9286605/)) |
| Hip, knee and ankle strength, their curves against angle, and torque against speed | Anderson, Madigan & Nussbaum 2007 ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6820133/)); Harbo et al. 2012 ([Springer](https://link.springer.com/doi/10.1007/s00421-011-1975-3)) |
| Trained men are 1.3 to 1.6 times as strong at the knee as untrained men | Maden-Wilkinson et al. 2020 ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7191505)) |
| Hip extension strength against hip angle, and how gluteus maximus, hamstrings and adductor magnus share it | Németh et al. 1983 ([J Rehabil Med](https://medicaljournals.se/jrm/content/abstract/10.2340/1650197719831597101)); Németh & Ohlsén 1985 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/3988782/)) |
| Muscle forces behind the share of each joint's strength | Rajagopal et al. 2016 ([model file](https://github.com/opensim-org/opensim-models/blob/master/Models/Rajagopal/Rajagopal2016.osim)); Saul et al. 2015 ([PDF](https://mobl.wordpress.ncsu.edu/files/2019/04/Saul-2014-ModelBenchmarking.pdf)) |
| Trunk, neck, shoulder girdle and arm strength | McNeill et al. 1980 ([CDC](https://stacks.cdc.gov/view/cdc/224853/cdc_224853_DS1.pdf)); Vasavada et al. 2001 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/11568704/)); Garner & Shim 2008 ([PDF](https://web.ecs.baylor.edu/faculty/garner/Research/GarnerShimShrugStrengthClinBiomech2007.pdf)); Holzbaur et al. 2007 ([PDF](https://nmbl.stanford.edu/publications/pdf/Holzbaur2007.pdf)); Delp et al. 1996 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/8884484/)); O'Sullivan & Gallwey 2002 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/12121684/)) |
| A bar-holding grip outlasts a dynamometer squeeze | Jukic et al. 2020 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/33044371/)) |
| Activation and deactivation times | OpenSim's Thelen 2003 muscle ([source](https://github.com/opensim-org/opensim-core/blob/main/OpenSim/Actuators/Thelen2003Muscle.cpp)); De Groote et al. 2016 (above) |
| Tendon strain at peak force | Millard et al. 2013, as in OpenSim ([source](https://github.com/opensim-org/opensim-core/blob/main/OpenSim/Actuators/TendonForceLengthCurve.h)) |

Dynamometer norms come from untrained people, so the lower body is scaled up to a trained lifter by the measured ratio. The upper body is set by what a trained 80 kg man lifts where the untrained norms could not bench press, do a pull-up or curl like one. The force-velocity curve keeps Anderson's shape with its top speed doubled, which is what the speed at which trained lifters move a given share of their maximum implies. Strength curves are extended flat beyond the angles Anderson tested, because the fitted cosine falls to a third at a deep squat's knee angle and nobody is that weak there.

## How it compares with measured activity

Measured activity is EMG as a share of a maximal isometric effort. It is not the same quantity as a share of strength, it routinely passes 100% in dynamic lifts, and values from different studies are not comparable muscle to muscle. So the comparison is of which muscles lead, which stay quiet, and the shape through the rep.

| Exercise | Model, at the default load | Measured |
|---|---|---|
| Barbell back squat, 60 kg | Quads lead, then glutes and adductors, lower back, hamstrings. Abs under 20%. Lifting about a fifth above lowering. | Vasti 59 to 99% lifting and 51 to 72% lowering; glutes 37 to 93%; hamstrings 29 to 71%; erectors 42 to 95%; rectus abdominis 4 to 11%, obliques 9 to 24% ([Aspe & Swinton 2014](https://pubmed.ncbi.nlm.nih.gov/24662228/); [Yavuz & Erdag 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5435978)) |
| 45° leg press, 100 kg | Quads lead by a wide margin; glutes, hamstrings, adductors and calves low. | Quadriceps largest in every study normalised to a maximal effort; hamstrings 11 to 20%; glutes measured once ([Martín-Fuentes et al. 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7369968)) |
| Push-up | Chest and triceps lead, then serratus, abs, front delts. Hands carry 66% of bodyweight at the top and 72% at the bottom. | Pecs 47 to 105%, triceps 66 to 109%, front delts 42 to 71%, serratus mostly 25 to 70%, rectus abdominis 10 to 25%; hands carry 69% and 75% ([Kowalski et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC9121296); [Calatayud et al. 2014](https://www.jssm.org/jssm-13-502.xml-Fulltext)) |
| Dumbbell Romanian deadlift, 12 kg a hand | Hamstrings lead, then lower back, glutes and adductors, upper back. Quads near zero. | Erectors, hamstrings and glutes lead; lats and mid traps moderate; quads 6 to 14%; the knee's net torque is a flexing one throughout ([Martín-Fuentes et al. 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7046193); [Lee et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6323186)) |
| Wide grip lat pulldown, 50 kg | Lats lead, then upper back, forearms, abs, biceps, chest. | Lats and teres major lead; biceps, mid and lower traps, pecs and triceps long head moderate ([Signorile et al. 2002](https://pubmed.ncbi.nlm.nih.gov/12423182/); [Lehman et al. 2004](https://pmc.ncbi.nlm.nih.gov/articles/PMC449729)) |

Measured activity is lower on the way down than on the way up in every study that splits the two, at about 40 to 75% for prime movers, and each muscle shows one rise and fall per phase. The model's force-velocity factor gives it the same shape.

## Where it is still crude

- **Torque generators, not muscles.** Nothing wraps around bone, and a moment arm changes with joint angle only where a strength curve says so. The shoulder has no strength curves at all.
- **One lifter.** 1.78 m, 80 kg, trained. Activations are shares of his strength.
- **Abdominals read high.** A plank and a leaned-back pulldown put the abs at 40%, about twice the measured activity. The lumbar torque itself checks out against a simple beam, so the gap is in how the trunk's flexor strength was measured or in what else carries that torque.
- **Friction is a flat half of the normal push** for every shoe, palm and bar.
- **Poses decide the answer.** A limb held a hand's breadth off the line of its load moves the work to another muscle. `validateLoad` flags a muscle that out-works the ones the catalog lists, and one that switches on more than once each way.
