import { AddIcon } from "@chakra-ui/icons";
import { Box, Stack, Text } from "@chakra-ui/layout";
import { useToast } from "@chakra-ui/toast";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSender } from "../config/ChatLogics";
import ChatLoading from "./ChatLoading";
import GroupChatModal from "./miscellaneous/GroupChatModal";
import {
  Button,
  FormControl,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  useDisclosure,
} from "@chakra-ui/react";
import { ChatState } from "../Context/ChatProvider";

const MyChats = ({ fetchAgain }) => {
  const [loggedUser, setLoggedUser] = useState();
  const [activeTab, setActiveTab] = useState("all");
  const [chatSearch, setChatSearch] = useState("");
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  const { selectedChat, setSelectedChat, user, chats, setChats } = ChatState();

  const toast = useToast();
  const {
    isOpen: isNewChatOpen,
    onOpen: onNewChatOpen,
    onClose: onNewChatClose,
  } = useDisclosure();

  const fetchChats = async () => {
    // console.log(user._id);
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      const { data } = await axios.get("/api/chat", config);
      setChats(data);
    } catch (error) {
      toast({
        title: "Error Occured!",
        description: "Failed to Load the chats",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-left",
      });
    }
  };

  useEffect(() => {
    setLoggedUser(JSON.parse(localStorage.getItem("userInfo")));
    fetchChats();
    // eslint-disable-next-line
  }, [fetchAgain]);

  const filteredChats = chats?.filter((chat) => {
    const name = chat.isGroupChat
      ? chat.chatName
      : getSender(loggedUser, chat.users);
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "groups" ? chat.isGroupChat : !chat.isGroupChat);
    const matchesSearch = name
      ?.toLowerCase()
      .includes(chatSearch.trim().toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleSearch = async () => {
    if (!search) {
      toast({
        title: "Please enter a name or email",
        status: "warning",
        duration: 4000,
        isClosable: true,
        position: "top-left",
      });
      return;
    }

    try {
      setLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.get(`/api/user?search=${search}`, config);
      setSearchResult(data);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      toast({
        title: "Error Occured!",
        description: "Failed to load the search results",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-left",
      });
    }
  };

  const closeNewChat = () => {
    setSearch("");
    setSearchResult([]);
    onNewChatClose();
  };

  const accessChat = async (userId) => {
    try {
      setLoadingChat(true);
      const config = {
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.post(`/api/chat`, { userId }, config);

      if (!chats.find((c) => c._id === data._id)) setChats([data, ...chats]);
      setSelectedChat(data);
      setLoadingChat(false);
      closeNewChat();
    } catch (error) {
      setLoadingChat(false);
      toast({
        title: "Error fetching the chat",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-left",
      });
    }
  };

  return (
    <Box
      d={{ base: selectedChat ? "none" : "flex", md: "flex" }}
      flexDir="column"
      alignItems="center"
      p={4}
      bg="#FFFFFF"
      w={{ base: "100%", md: "31%" }}
      borderRadius="12px"
      boxShadow="2px 0 12px rgba(0,0,0,0.04)"
    >
      <Box w="100%" pb={3}>
        <Box
          d="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Text fontSize="22px" fontWeight="700" fontFamily="Outfit">
            Chats
          </Text>
          <Menu placement="bottom-end">
            <MenuButton
              as={IconButton}
              aria-label="Create"
              icon={<AddIcon />}
              bg="linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)"
              color="white"
              borderRadius="full"
              _hover={{ transform: "translateY(-1px)", boxShadow: "md" }}
              transition="all 0.2s ease"
            />
            <MenuList>
              <MenuItem onClick={onNewChatOpen}>New Chat</MenuItem>
              <GroupChatModal>
                <MenuItem>New Group</MenuItem>
              </GroupChatModal>
            </MenuList>
          </Menu>
        </Box>

        <InputGroup mb={3}>
          <InputLeftElement pointerEvents="none" color="#9CA3AF">
            <i className="fas fa-search"></i>
          </InputLeftElement>
          <Input
            placeholder="Search chats..."
            bg="#F3F4F6"
            border="none"
            borderRadius="full"
            fontSize="sm"
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            _focus={{ bg: "white", boxShadow: "0 0 0 2px #C7D2FE" }}
          />
        </InputGroup>

        <Box d="flex" gap={2}>
          <Button
            size="sm"
            borderRadius="full"
            variant={activeTab === "all" ? "solid" : "ghost"}
            bg={activeTab === "all" ? "#4F46E5" : "transparent"}
            color={activeTab === "all" ? "white" : "#6B7280"}
            _hover={{ bg: activeTab === "all" ? "#4338CA" : "#EEF2FF" }}
            onClick={() => setActiveTab("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            borderRadius="full"
            variant={activeTab === "direct" ? "solid" : "ghost"}
            bg={activeTab === "direct" ? "#4F46E5" : "transparent"}
            color={activeTab === "direct" ? "white" : "#6B7280"}
            _hover={{ bg: activeTab === "direct" ? "#4338CA" : "#EEF2FF" }}
            onClick={() => setActiveTab("direct")}
          >
            Direct
          </Button>
          <Button
            size="sm"
            borderRadius="full"
            variant={activeTab === "groups" ? "solid" : "ghost"}
            bg={activeTab === "groups" ? "#4F46E5" : "transparent"}
            color={activeTab === "groups" ? "white" : "#6B7280"}
            _hover={{ bg: activeTab === "groups" ? "#4338CA" : "#EEF2FF" }}
            onClick={() => setActiveTab("groups")}
          >
            Groups
          </Button>
        </Box>
      </Box>
      <Box
        d="flex"
        flexDir="column"
        p={2}
        bg="#FFFFFF"
        w="100%"
        h="100%"
        borderRadius="12px"
        overflowY="hidden"
      >
        {chats ? (
          <Stack overflowY="scroll">
            {filteredChats?.map((chat) => (
              <Box
                onClick={() => setSelectedChat(chat)}
                cursor="pointer"
                bg={selectedChat === chat ? "#E0E7FF" : "#F9FAFB"}
                color="#111827"
                px={3}
                py={3}
                borderRadius="12px"
                mb={2}
                borderLeft={selectedChat === chat ? "4px solid #4F46E5" : "4px solid transparent"}
                transition="all 0.2s ease"
                _hover={{ bg: "#EEF2FF" }}
                key={chat._id}
              >
                <Text fontWeight="600" fontFamily="Work sans">
                  {!chat.isGroupChat
                    ? getSender(loggedUser, chat.users)
                    : chat.chatName}
                </Text>
                {chat.latestMessage &&
                  !chat.latestMessage.content?.startsWith("[SUMMARY]") && (
                  <Text fontSize="xs" color="#6B7280">
                    <Text as="span" fontWeight="600" color="#111827">
                      {chat.latestMessage.sender.name} :{" "}
                    </Text>
                    {chat.latestMessage.content.length > 50
                      ? chat.latestMessage.content.substring(0, 51) + "..."
                      : chat.latestMessage.content}
                  </Text>
                )}
              </Box>
            ))}
          </Stack>
        ) : (
          <ChatLoading />
        )}
      </Box>
      <Modal isOpen={isNewChatOpen} onClose={closeNewChat} isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="xl">
          <ModalHeader>Start a New Chat</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl>
              <Box d="flex" gap={2} mb={3}>
                <Input
                  placeholder="Search by name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button onClick={handleSearch}>Go</Button>
              </Box>
            </FormControl>
            {loading ? (
              <ChatLoading />
            ) : (
              searchResult?.map((user) => (
                <Box
                  key={user._id}
                  p={3}
                  mb={2}
                  borderRadius="md"
                  border="1px solid #E5E7EB"
                  cursor="pointer"
                  _hover={{ bg: "#F3F4F6" }}
                  onClick={() => accessChat(user._id)}
                >
                  <Text fontWeight="600">{user.name}</Text>
                  <Text fontSize="xs" color="#6B7280">
                    {user.email}
                  </Text>
                </Box>
              ))
            )}
            {loadingChat && <Spinner ml="auto" d="flex" />}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default MyChats;
