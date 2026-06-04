// Static schedule data used by main.js for meal alerts and Today cards.
export const MEALS = [
  {
    id: "breakfast",
    label: "BREAKFAST",
    time: "07:00",
    displayTime: "7:00 AM",
  },
  { id: "lunch", label: "LUNCH", time: "12:00", displayTime: "12:00 PM" },
  { id: "supper", label: "SUPPER", time: "17:00", displayTime: "5:00 PM" },
];

// Weekday-specific notes rendered on the Today shelf/home objects.
export const TODAY_SPECIALS = {
  thursday: {
    title: "Bible Study",
    time: "10:30 AM",
    place: "Gathering Room",
    note: "Bible Study is today in the Gathering Room.",
  },
  friday: {
    title: "Laundry and Cleaning",
    time: "Today",
    place: "Your room",
    note: "Laundry Day and Room Cleaning Day are today.",
  },
  sunday: {
    title: "Church Service",
    time: "10:30 AM",
    place: "Chapel",
    note: "Church Service is today at 10:30.",
  },
};
