import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthProvider } from "./context/AuthContext";
import { UserProvider } from "./context/UserContext";
import { ModeProvider } from "./context/ModeContext";

export default function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <ModeProvider>
          <RouterProvider router={router} />
        </ModeProvider>
      </UserProvider>
    </AuthProvider>
  );
}
