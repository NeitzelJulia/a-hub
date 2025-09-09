import './App.css'
import DoorbellModal from "../features/doorbell/components/DoorbellModal.tsx";
import DashboardPage from "../pages/dashboard/DashboardPage.tsx";

export default function App() {
  return (
      <>
          <DoorbellModal />
          <DashboardPage />
      </>
  )
}
