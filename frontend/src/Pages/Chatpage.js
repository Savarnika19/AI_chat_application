import { Box } from "@chakra-ui/layout";
import { useState } from "react";
import Chatbox from "../components/Chatbox";
import MyChats from "../components/MyChats";
import SideDrawer from "../components/miscellaneous/SideDrawer";
import { ChatState } from "../Context/ChatProvider";

const Chatpage = () => {
  const [fetchAgain, setFetchAgain] = useState(false);
  const { user } = ChatState();

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#F6F7FB",
        backgroundImage:
          "radial-gradient(circle at 10% 10%, rgba(79,70,229,0.08), transparent 40%), radial-gradient(circle at 90% 20%, rgba(14,165,233,0.08), transparent 45%)",
      }}
    >
      {user && <SideDrawer />}
      <Box
        d="flex"
        justifyContent="space-between"
        w="100%"
        h="calc(100vh - 64px)"
        p={{ base: "12px", md: "16px" }}
        gap={{ base: 3, md: 4 }}
      >
        {user && <MyChats fetchAgain={fetchAgain} />}
        {user && (
          <Chatbox fetchAgain={fetchAgain} setFetchAgain={setFetchAgain} />
        )}
      </Box>
    </div>
  );
};

export default Chatpage;
