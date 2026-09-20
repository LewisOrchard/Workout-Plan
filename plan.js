// Personal push/pull/legs/accessories routine.
// Reps are stored as the string shown on the plan (e.g. "8-12"); the log
// form pre-fills using the low end of the range as a sane default.
const WORKOUT_PLAN = {
  Push: [
    { name: "Incline Dumbbell Press", sets: 4, reps: "6-10", cue: "Big stretch at bottom, 3 second hold" },
    { name: "Dumbbell Fly (Decline/Flat)", sets: 5, reps: "8-12", cue: "3 second hold at the bottom for big stretch, don't go all the way to the top" },
    { name: "Incline Lateral Raise", sets: 3, reps: "10-15", cue: "" },
    { name: "Cable Lateral Raise", sets: 3, reps: "10-15", cue: "Wide cables" },
    { name: "Decline Cable Fly", sets: 4, reps: "8-12", cue: "" },
    { name: "Overhead Tricep Extension", sets: 3, reps: "8-12", cue: "" },
    { name: "Tricep Extension", sets: 3, reps: "8-12", cue: "" },
    { name: "Reverse Grip Extension", sets: 2, reps: "8-12", cue: "Straight bar tri extension" },
    { name: "Calf Raise", sets: 3, reps: "10", cue: "5 second stretch" },
  ],
  Pull: [
    { name: "Bayesian Curls / Seated Dumbbell Curl", sets: 3, reps: "6-12", cue: "Do partials and dropsets" },
    { name: "Hammer Curls", sets: 3, reps: "6-12", cue: "Do partials at the end" },
    { name: "V Bar Pull Thing / 1 Arm Row", sets: 4, reps: "6-12", cue: "Full stretch and shrug on last set when you can't do any more" },
    { name: "Pull Down", sets: 3, reps: "6-12", cue: "Long length partials at the end of the sets, control the negative" },
    { name: "Hammer Concentration Curl", sets: 2, reps: "8-12", cue: "" },
    { name: "Regular Concentration Curl", sets: 2, reps: "8-12", cue: "" },
    { name: "Sam Sulek Curls", sets: 4, reps: "15", cue: "" },
    { name: "Rear Cable Flys", sets: 5, reps: "10-15", cue: "Sweep arms back, stretch all the way back" },
    { name: "Pronated Curl", sets: 2, reps: "8-12", cue: "" },
    { name: "Calf Raise", sets: 3, reps: "10", cue: "5 second stretch, stretch in between sets" },
    { name: "Cable Lateral Raises", sets: 3, reps: "10-15", cue: "" },
  ],
  Legs: [
    { name: "Ass to Grass Squats", sets: 4, reps: "5", cue: "" },
    { name: "Lengthened Squats", sets: 5, reps: "8-10", cue: "" },
    { name: "Leg Extension", sets: 5, reps: "8-10", cue: "" },
    { name: "RDL", sets: 5, reps: "8", cue: "3 second hold, push glutes back" },
    { name: "Leg Press", sets: 3, reps: "8", cue: "Lift toes, hold at bottom to focus on VMO (tear drop)" },
    { name: "Hip Thrusts", sets: 3, reps: "10", cue: "" },
    { name: "Calf Raise", sets: 3, reps: "10", cue: "5 second stretch, try a wider stance" },
    { name: "Cable Lateral Raises", sets: 3, reps: "10-15", cue: "" },
  ],
  Accessories: [
    { name: "Hanging Leg Raise", sets: 5, reps: "10-15", cue: "Put dumbbell between feet" },
    { name: "Crunch", sets: 5, reps: "12-15", cue: "" },
    { name: "Side Swings", sets: 5, reps: "10-15", cue: "" },
    { name: "Spinal Flexion", sets: 2, reps: "10-20", cue: "" },
    { name: "Cable Lateral Raises", sets: 5, reps: "12-15", cue: "Do partials on last few sets" },
    { name: "Forearm Curl", sets: 5, reps: "10-15", cue: "Sam Sulek style" },
    { name: "Calf Raise", sets: 5, reps: "10", cue: "5 second stretch" },
  ],
};
