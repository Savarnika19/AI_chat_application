import { Box } from "@chakra-ui/layout";
import "./styles.css";
import SingleChat from "./SingleChat";
import { ChatState } from "../Context/ChatProvider";

const Chatbox = ({ fetchAgain, setFetchAgain }) => {
  const { selectedChat } = ChatState();

  return (
    <Box
      d={{ base: selectedChat ? "flex" : "none", md: "flex" }}
      alignItems="center"
      flexDir="column"
      p={4}
      bg="white"
      w={{ base: "100%", md: "68%" }}
      borderRadius="16px"
      borderWidth="1px"
      borderColor="#E5E7EB"
      boxShadow="0 12px 28px rgba(17,24,39,0.08)"
    >
      <SingleChat fetchAgain={fetchAgain} setFetchAgain={setFetchAgain} />
    </Box>
  );
};

export default Chatbox;
