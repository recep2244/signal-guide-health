import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AlertsProvider } from "@/context/AlertsContext";
import Dashboard from "@/pages/Dashboard";

describe("Dashboard", () => {
  it("renders overview and patient list", () => {
    render(
      <AlertsProvider>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </AlertsProvider>
    );

    expect(screen.getByText("Today's Overview")).toBeInTheDocument();
    expect(screen.getByText("Margaret Thompson")).toBeInTheDocument();
  });
});
