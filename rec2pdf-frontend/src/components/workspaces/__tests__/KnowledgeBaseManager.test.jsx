import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KnowledgeBaseManager from "../KnowledgeBaseManager.jsx";
import { AppContext } from "../../../hooks/useAppContext.jsx";

describe("KnowledgeBaseManager", () => {
  const renderWithContext = (ui, contextOverrides = {}) => {
    const contextValue = {
      normalizedBackendUrl: "http://localhost/",
      fetchBody: vi.fn().mockResolvedValue({ ok: true, data: { files: [] } }),
      ...contextOverrides,
    };

    const renderResult = render(
      <AppContext.Provider value={contextValue}>{ui}</AppContext.Provider>,
    );

    return { ...renderResult, contextValue };
  };

  it("permette di selezionare un progetto e includerlo nell'upload", async () => {
    const fetchBody = vi.fn().mockResolvedValue({ ok: true, data: { files: [] } });
    const { container } = renderWithContext(
      <KnowledgeBaseManager
        workspaceId="ws-1"
        projects={[
          { id: "proj-1", name: "Discovery" },
          { id: "proj-2", name: "Delivery" },
        ]}
      />,
      { fetchBody },
    );

    await waitFor(() => {
      expect(fetchBody).toHaveBeenCalledWith(
        "http://localhost/api/workspaces/ws-1/knowledge",
        { method: "GET" },
      );
    });

    const scopeSelect = screen.getByLabelText(/Ambito knowledge/i);
    await userEvent.selectOptions(scopeSelect, "proj-1");

    await waitFor(() => {
      expect(fetchBody).toHaveBeenCalledWith(
        "http://localhost/api/workspaces/ws-1/knowledge?projectId=proj-1",
        { method: "GET" },
      );
    });

    const input = container.querySelector('input[type="file"]');
    const file = new File(["contenuto"], "nota.txt", { type: "text/plain" });
    await userEvent.upload(input, file);

    await waitFor(() => {
      const uploadCall = fetchBody.mock.calls.find(([, options]) => options?.method === "POST");
      expect(uploadCall).toBeTruthy();
      const [, options] = uploadCall;
      expect(options.body instanceof FormData).toBe(true);
      const projectIds = options.body.getAll("workspaceProjectId");
      expect(projectIds).toEqual(["proj-1"]);
      const files = options.body.getAll("files");
      expect(files[0].name).toBe("nota.txt");
    });
  });
});
