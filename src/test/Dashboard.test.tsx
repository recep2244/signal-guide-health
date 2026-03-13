import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlertsProvider } from "@/context/AlertsContext";
import { AuthProvider } from "@/context/AuthContext";
import Dashboard from "@/demo/pages/Dashboard";

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

describe("Dashboard", () => {
  it("renders overview and patient list", async () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AlertsProvider>
            <MemoryRouter>
              <Dashboard />
            </MemoryRouter>
          </AlertsProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Wait for loading to complete and content to appear
    await waitFor(() => {
      expect(screen.getByText("Today's Overview")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText("Margaret Thompson").length).toBeGreaterThan(0);
    });
  });
});
