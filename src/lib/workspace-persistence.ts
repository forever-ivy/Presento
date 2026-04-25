import type { DefenseWorkspace } from "./project-workspace.ts";
import { readWorkspaceFromDatabase, writeWorkspaceToDatabase } from "./workspace-db.ts";
import { readStoredWorkspace, writeStoredWorkspace } from "./workspace-store.ts";

type WorkspacePersistenceDeps = {
  readDatabase: () => Promise<DefenseWorkspace | null>;
  writeDatabase: (workspace: DefenseWorkspace) => Promise<DefenseWorkspace>;
  readStore: () => Promise<DefenseWorkspace | null>;
  writeStore: (workspace: DefenseWorkspace) => Promise<DefenseWorkspace>;
};

export function createWorkspacePersistence(deps: WorkspacePersistenceDeps) {
  return {
    async readWorkspace() {
      try {
        const databaseWorkspace = await deps.readDatabase();
        if (databaseWorkspace) return databaseWorkspace;
      } catch {
        // JSON storage keeps the MVP usable when local Docker is stopped.
      }

      return deps.readStore();
    },

    async writeWorkspace(workspace: DefenseWorkspace) {
      try {
        const databaseWorkspace = await deps.writeDatabase(workspace);
        await deps.writeStore(databaseWorkspace);
        return databaseWorkspace;
      } catch {
        return deps.writeStore(workspace);
      }
    },
  };
}

export const workspacePersistence = createWorkspacePersistence({
  readDatabase: readWorkspaceFromDatabase,
  writeDatabase: writeWorkspaceToDatabase,
  readStore: readStoredWorkspace,
  writeStore: writeStoredWorkspace,
});
