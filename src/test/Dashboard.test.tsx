import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlertsProvider } from "@/context/AlertsContext";
import Dashboard from "@/pages/Dashboard";

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
        <AlertsProvider>
          <MemoryRouter>
            <Dashboard />
          </MemoryRouter>
        </AlertsProvider>
      </QueryClientProvider>
    );

    // Wait for loading to complete and content to appear
    await waitFor(() => {
      expect(screen.getByText("Today's Overview")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Margaret Thompson")).toBeInTheDocument();
    });
  });
});
