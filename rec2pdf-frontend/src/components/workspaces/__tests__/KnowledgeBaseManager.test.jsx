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

  it("permette di eliminare un documento dalla knowledge base", async () => {
    const knowledgeResponses = [
      {
        ok: true,
        data: {
          files: [
            {
              name: "executive.txt",
              chunkCount: 6,
              size: 2048,
              lastIngestedAt: "2024-02-18T10:00:00.000Z",
              projectScopeId: null,
            },
          ],
        },
      },
      { ok: true, data: { files: [] } },
    ];

    const fetchBody = vi.fn((url, options = {}) => {
      if (options.method === "DELETE") {
        return Promise.resolve({
          ok: true,
          data: { message: "Documento eliminato", removed: 6 },
        });
      }
      if (url.includes("/knowledge")) {
        const response = knowledgeResponses.shift();
        return Promise.resolve(response || { ok: true, data: { files: [] } });
      }
      return Promise.resolve({ ok: true, data: {} });
    });

    renderWithContext(<KnowledgeBaseManager workspaceId="ws-1" projects={[]} />, { fetchBody });

    await waitFor(() => {
      expect(fetchBody).toHaveBeenCalledWith(
        "http://localhost/api/workspaces/ws-1/knowledge",
        { method: "GET" },
      );
    });

    await waitFor(() => {
      expect(screen.getByText("executive.txt")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /Elimina documento/i });
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(fetchBody.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(true);
    });

    const deleteCall = fetchBody.mock.calls.find(([, options]) => options?.method === "DELETE");
    expect(deleteCall[0]).toBe("http://localhost/api/workspaces/ws-1/knowledge");
    expect(deleteCall[1].headers["Content-Type"]).toBe("application/json");
    const payload = JSON.parse(deleteCall[1].body);
    expect(payload).toMatchObject({ fileName: "executive.txt" });
    expect(payload.projectScopeId).toBeUndefined();
  });
});
