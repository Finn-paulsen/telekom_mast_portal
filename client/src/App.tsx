import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PortalSessionProvider } from "./contexts/PortalSession";
import Login from "./pages/Login";
import MastMap from "./pages/MastMap";
import MastConsole from "./pages/MastConsole";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Login} />
      <Route path={"/karte"} component={MastMap} />
      <Route path={"/mast/:siteId"} component={MastConsole} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "hsl(222 44% 9%)",
                border: "1px solid hsl(222 30% 22%)",
                color: "hsl(216 30% 92%)",
              },
            }}
          />
          <PortalSessionProvider>
            <Router />
          </PortalSessionProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
