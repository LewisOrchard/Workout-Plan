// Personal push/pull/legs/accessories routine.
// Reps are stored as the string shown on the plan (e.g. "8-12"); the log
// form pre-fills using the low end of the range as a sane default.
// `machine: true` marks exercises done on a machine/cable stack, where the
// weight number isn't comparable between gyms (different equipment, pulley
// ratios, etc.) -- used to default Exercise Progress to "this gym only" for
// these, vs. "all gyms" for free weights. It's just a starting default: the
// gym filter in Exercise Progress can always be switched by hand.
const WORKOUT_PLAN = {
  Push: [
    { name: "Incline Dumbbell Press", sets: 4, reps: "6-10", cue: "Big stretch at bottom, 3 second hold" },
    { name: "Dumbbell Fly (Decline/Flat)", sets: 5, reps: "8-12", cue: "3 second hold at the bottom for big stretch, don't go all the way to the top" },
    { name: "Incline Lateral Raise", sets: 3, reps: "10-15", cue: "" },
    { name: "Cable Lateral Raise", sets: 3, reps: "10-15", cue: "Wide cables", machine: true },
    { name: "Decline Cable Fly", sets: 4, reps: "8-12", cue: "", machine: true },
    { name: "Overhead Tricep Extension", sets: 3, reps: "8-12", cue: "", machine: true },
    { name: "Tricep Extension", sets: 3, reps: "8-12", cue: "", machine: true },
    { name: "Reverse Grip Extension", sets: 2, reps: "8-12", cue: "Straight bar tri extension", machine: true },
    { name: "Calf Raise", sets: 3, reps: "10", cue: "5 second stretch", machine: true },
  ],
  Pull: [
    { name: "Bayesian Curls / Seated Dumbbell Curl", sets: 3, reps: "6-12", cue: "Do partials and dropsets" },
    { name: "Hammer Curls", sets: 3, reps: "6-12", cue: "Do partials at the end" },
    { name: "V Bar Pull Thing / 1 Arm Row", sets: 4, reps: "6-12", cue: "Full stretch and shrug on last set when you can't do any more", machine: true },
    { name: "Pull Down", sets: 3, reps: "6-12", cue: "Long length partials at the end of the sets, control the negative", machine: true },
    { name: "Hammer Concentration Curl", sets: 2, reps: "8-12", cue: "" },
    { name: "Regular Concentration Curl", sets: 2, reps: "8-12", cue: "" },
    { name: "Sam Sulek Curls", sets: 4, reps: "15", cue: "" },
    { name: "Rear Cable Flys", sets: 5, reps: "10-15", cue: "Sweep arms back, stretch all the way back", machine: true },
    { name: "Pronated Curl", sets: 2, reps: "8-12", cue: "" },
    { name: "Calf Raise", sets: 3, reps: "10", cue: "5 second stretch, stretch in between sets", machine: true },
    { name: "Cable Lateral Raises", sets: 3, reps: "10-15", cue: "", machine: true },
  ],
  Legs: [
    { name: "Ass to Grass Squats", sets: 4, reps: "5", cue: "" },
    { name: "Lengthened Squats", sets: 5, reps: "8-10", cue: "" },
    { name: "Leg Extension", sets: 5, reps: "8-10", cue: "", machine: true },
    { name: "RDL", sets: 5, reps: "8", cue: "3 second hold, push glutes back" },
    { name: "Leg Press", sets: 3, reps: "8", cue: "Lift toes, hold at bottom to focus on VMO (tear drop)", machine: true },
    { name: "Hip Thrusts", sets: 3, reps: "10", cue: "" },
    { name: "Calf Raise", sets: 3, reps: "10", cue: "5 second stretch, try a wider stance", machine: true },
    { name: "Cable Lateral Raises", sets: 3, reps: "10-15", cue: "", machine: true },
  ],
  Accessories: [
    { name: "Hanging Leg Raise", sets: 5, reps: "10-15", cue: "Put dumbbell between feet" },
    { name: "Crunch", sets: 5, reps: "12-15", cue: "" },
    { name: "Side Swings", sets: 5, reps: "10-15", cue: "" },
    { name: "Spinal Flexion", sets: 2, reps: "10-20", cue: "" },
    { name: "Cable Lateral Raises", sets: 5, reps: "12-15", cue: "Do partials on last few sets", machine: true },
    { name: "Forearm Curl", sets: 5, reps: "10-15", cue: "Sam Sulek style" },
    { name: "Calf Raise", sets: 5, reps: "10", cue: "5 second stretch", machine: true },
  ],
};
