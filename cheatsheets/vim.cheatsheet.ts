export const vimCheatSheet = {
  navigation: [
    { key: "h", description: "Move left" },
    { key: "j", description: "Move down" },
    { key: "k", description: "Move up" },
    { key: "l", description: "Move right" }
  ],
  insertModeCommands: [
    { key: "i", description: "Enter insert mode (before current character)" },
    { key: "a", description: "Enter append mode (after current character)" },
    { key: "I", description: "Enter insert mode at the beginning of the line" },
    { key: "A", description: "Enter append mode at the end of the line" }
  ],
  searchReplace: [
    { key: "/pattern", description: "Search for a pattern" },
    { key: "n", description: "Next occurrence of the search pattern" },
    { key: "N", description: "Previous occurrence of the search pattern" }
  ],
  exMode: {
    commandLine: ": Enter Ex mode to execute commands like saving, quitting, etc."
  }
};
