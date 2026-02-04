#!/bin/zsh

# Create project directory and initialize package.json
mkdir cheetsheet && cd cheetsheet
echo '{
  "name": "cheetsheet",
  "version": "1.0.0",
  "description": "Cheat sheets for VIM, nano, Mac OS finder, Git in TypeScript",
  "main": "index.js",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@types/node": "^18.7.4",  # Example type definition
    "typescript": "^4.6.2"     # Example TypeScript version
  }
}' > package.json

# Create cheat sheet files
mkdir -p cheatsheets
echo 'export const vimCheatSheet = {
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
};' > cheatsheets/vim.cheatsheet.ts

echo 'export const nanoCheatSheet = {
  navigation: [
    { key: "Arrow keys", description: "Move cursor around" },
    { key: "Up", description: "Move up" },
    { key: "Down", description: "Move down" },
    { key: "Left", description: "Move left" },
    { key: "Right", description: "Move right" }
  ],
  insertText: [
    { key: "Ctrl + a to move cursor left", description: "" },
    { key: "Ctrl + o to write and exit", description: "" },
    { key: "Ctrl + k to cut the current line", description: "" }
  ],
  editingText: [
    { key: "Ctrl + w to cut word under or before the cursor", description: "" },
    { key: "Alt + d to delete the current word", description: "" }
  ]
};' > cheatsheets/nano.cheatsheet.ts

echo 'export const finderCheatSheet = {
  basicFileManagement: [
    { action: "Drag and drop files to move them", description: "" },
    { action: "Right-click context menu for file operations like copying, moving, renaming, etc.", description: "" }
  ],
  searchingFilesFolders: [
    { key: "Command + F", description: "Open search bar at top of the window" },
    { key: "Use the search bar to find files or folders by name, kind, or other attributes", description: "" }
  ],
  organizingFilesFolders: [
    { action: "Right-click (or Control-click) a folder and choose \"New Folder\" from the context menu", description: "" }
  ]
};' > cheatsheets/finder.cheatsheet.ts

echo 'export const gitCheatSheet = {
  cloningRepository: ["git clone <url> - Clone a repository from a remote source"],
  committingChanges: [
    { command: "git add .", description: "Add all changes in the working directory to the staging area" },
    { command: "git commit -m \"commit message\"", description: "Commit the staged changes with a descriptive message" }
  ],
  pushingChanges: ["git push - Push committed and stashed local branches to remote repository"],
  branching: [
    { command: "git branch <branch-name>", description: "Create a new branch named <branch-name>" },
    { command: "git checkout <branch-name> or git switch <branch-name>", description: "Switch to the specified branch" }
  ]
};' > cheatsheets/git.cheatsheet.ts
