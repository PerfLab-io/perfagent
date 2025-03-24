import { registerTool } from "../mock-ai-sdk";

export const openSidePanelTool = registerTool({
  name: "openSidePanel",
  description: "Opens the side panel with learning analytics",
  execute: async (params: { query: string }) => {
    // Return data for the side panel
    return {
      type: "sidePanel",
      panelType: "analytics",
      data: {
        // This would contain the data needed for the analytics panel
        // For now, we'll just return a simple indicator
        showPanel: true,
      },
    };
  },
});
