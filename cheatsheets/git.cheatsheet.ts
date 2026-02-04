export const gitCheatSheet = {
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
};
