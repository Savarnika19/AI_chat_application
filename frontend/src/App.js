import "./App.css";
import Homepage from "./Pages/Homepage";
import { Route } from "react-router-dom";
import Chatpage from "./Pages/Chatpage";
import ExpenseDashboardPage from "./Pages/ExpenseDashboardPage";
import ExpenseGroupPage from "./Pages/ExpenseGroupPage";

function App() {
  return (
    <div className="App">
      <Route path="/" component={Homepage} exact />
      <Route path="/chats" component={Chatpage} />
      <Route path="/expenses" component={ExpenseDashboardPage} exact />
      <Route path="/expenses/:groupId" component={ExpenseGroupPage} />
    </div>
  );
}

export default App;
