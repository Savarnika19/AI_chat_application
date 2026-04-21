import { FormControl } from "@chakra-ui/form-control";
import { Input } from "@chakra-ui/input";
import { Box, Text } from "@chakra-ui/layout";
import "./styles.css";
import { IconButton, Spinner, useToast, Button, useDisclosure, Menu, MenuButton, MenuList, MenuItem, VStack, HStack } from "@chakra-ui/react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowBackIcon } from "@chakra-ui/icons";
import ProfileModal from "./miscellaneous/ProfileModal";
import ScrollableChat from "./ScrollableChat";
import Lottie from "react-lottie";
import animationData from "../animations/typing.json";

import io from "socket.io-client";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import SummarizeModal from "./miscellaneous/SummarizeModal";
import { ChatState } from "../Context/ChatProvider";
const ENDPOINT = process.env.REACT_APP_API_URL || "http://localhost:5000";
var socket, selectedChatCompare;

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [istyping, setIsTyping] = useState(false);


  // Summarization State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [summary, setSummary] = useState("");
  const [summarizeLoading, setSummarizeLoading] = useState(false);
  const { isOpen: isSummarizeOpen, onOpen: onSummarizeOpen, onClose: onSummarizeClose } = useDisclosure();

  const toast = useToast();

  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  };
  const { selectedChat, setSelectedChat, user, notification, setNotification, dbNotifications, setDbNotifications, scrollToMessage, setScrollToMessage } =
    ChatState();
  const otherUser = selectedChat && !selectedChat.isGroupChat
    ? getSenderFull(user, selectedChat.users)
    : null;

  const fetchMessages = async () => {
    if (!selectedChat) return;

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      setLoading(true);

      const { data } = await axios.get(
        `/api/message/${selectedChat._id}`,
        config
      );
      setMessages(
        data.filter((m) => !m.content?.startsWith("[SUMMARY]"))
      );
      setLoading(false);

      socket.emit("join chat", selectedChat._id);
    } catch (error) {
      toast({
        title: "Error Occured!",
        description: "Failed to Load the Messages",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    }
  };

  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage) {
      socket.emit("stop typing", selectedChat._id);
      try {
        const config = {
          headers: {
            "Content-type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };
        setNewMessage("");
        const { data } = await axios.post(
          "/api/message",
          {
            content: newMessage,
            chatId: selectedChat,
          },
          config
        );
        socket.emit("new message", data);
        setMessages([...messages, data]);
      } catch (error) {
        toast({
          title: "Error Occured!",
          description: "Failed to send the Message",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "bottom",
        });
      }
    }
  };

  useEffect(() => {
    socket = io(ENDPOINT);
    socket.emit("setup", user);
    socket.on("connected", () => setSocketConnected(true));
    socket.on("typing", () => setIsTyping(true));
    socket.on("stop typing", () => setIsTyping(false));

    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    fetchMessages();

    selectedChatCompare = selectedChat;
    // eslint-disable-next-line
  }, [selectedChat]);

  useEffect(() => {
    const handleMessageReceived = (newMessageRecieved) => {
      if (newMessageRecieved?.content?.startsWith("[SUMMARY]")) {
        return;
      }
      if (
        !selectedChatCompare ||
        selectedChatCompare._id !== newMessageRecieved.chat._id
      ) {
        if (!notification.some(n => n._id === newMessageRecieved._id)) {
          setNotification([newMessageRecieved, ...notification]);
          setFetchAgain(!fetchAgain);
        }
      } else {
        setMessages([...messages, newMessageRecieved]);
      }
    };

    const handleNotificationReceived = (newNotif) => {
      if (!dbNotifications.some(n => n._id === newNotif._id)) {
        setDbNotifications([newNotif, ...dbNotifications]);
      }
    };

    socket.on("message recieved", handleMessageReceived);
    socket.on("notification recieved", handleNotificationReceived);

    return () => {
      socket.off("message recieved", handleMessageReceived);
      socket.off("notification recieved", handleNotificationReceived);
    };
  });

  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", selectedChat._id);
    }
    let lastTypingTime = new Date().getTime();
    var timerLength = 3000;
    setTimeout(() => {
      var timeNow = new Date().getTime();
      var timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.emit("stop typing", selectedChat._id);
        setTyping(false);
      }
    }, timerLength);
  };

  const handleSelectMessage = (messageId) => {
    if (selectedMessages.includes(messageId)) {
      setSelectedMessages(selectedMessages.filter((id) => id !== messageId));
    } else {
      setSelectedMessages([...selectedMessages, messageId]);
    }
  };

  const handleSummarize = async (type) => {
    setSummarizeLoading(true);
    onSummarizeOpen();
    try {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      const payload = type === "unread" ? { chatId: selectedChat._id } : { messageIds: selectedMessages };

      const { data } = await axios.post("/api/message/summarize", payload, config);
      setSummary(data.summary);
      setSummarizeLoading(false);

      // Reset selection mode if used
      if (type === "selected") {
        setIsSelectionMode(false);
        setSelectedMessages([]);
      }
    } catch (error) {
      setSummary("Error generating summary.");
      setSummarizeLoading(false);
      toast({
        title: "Error",
        description: "Failed to generate summary",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };

      await axios.post("/api/message/delete", { messageIds: selectedMessages }, config);

      // Remove from local state
      setMessages(messages.filter(m => !selectedMessages.includes(m._id)));
      setSelectedMessages([]);
      setIsSelectionMode(false);
      toast({
        title: "Success",
        description: "Messages deleted",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete messages",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    }
  };

  // Check for unreads (naive check: messages not read by me)
  const hasUnreadMessages = messages && messages.some(m => !m.readBy.includes(user._id) && m.sender._id !== user._id);

  const handleDeleteChat = async () => {
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
    try {
      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
      };
      await axios.delete(`/api/chat/${selectedChat._id}`, config);

      setSelectedChat(null);
      setFetchAgain(!fetchAgain);
      toast({ title: "Chat Deleted", status: "success", duration: 3000, isClosable: true, position: "bottom" });
    } catch (error) {
      toast({ title: "Error Deleting Chat", description: error.message, status: "error", duration: 3000, isClosable: true, position: "bottom" });
    }
  };

  return (
    <>
      {selectedChat ? (
        <>
          <Text
            fontSize={{ base: "28px", md: "30px" }}
            pb={3}
            px={2}
            w="100%"
            fontFamily="Outfit"
            d="flex"
            justifyContent={{ base: "space-between" }}
            alignItems="center"
            color="#111827"
            fontWeight="bold"
          >
            <IconButton
              d={{ base: "flex", md: "none" }}
              icon={<ArrowBackIcon />}
              onClick={() => setSelectedChat("")}
            />
            {messages &&
              (!selectedChat.isGroupChat ? (
                <>
                  <Text as="span" color="#111827">
                    {getSender(user, selectedChat.users)}
                  </Text>
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      aria-label="Chat options"
                      icon={<i className="fas fa-ellipsis-v"></i>}
                      variant="ghost"
                      size="sm"
                      ml={2}
                    />
                    <MenuList fontSize="sm" minW="150px" p={1}>
                      {otherUser && (
                        <ProfileModal user={otherUser}>
                          <MenuItem fontSize="sm" borderRadius="md">
                            View contact
                          </MenuItem>
                        </ProfileModal>
                      )}
                      <MenuItem
                        fontSize="sm"
                        borderRadius="md"
                        onClick={() => handleDeleteChat()}
                      >
                        Delete chat
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </>
              ) : (
                <>
                  {selectedChat.chatName.toUpperCase()}
                  <UpdateGroupChatModal
                    fetchMessages={fetchMessages}
                    fetchAgain={fetchAgain}
                    setFetchAgain={setFetchAgain}
                  />
                </>
              ))}
          </Text>

          {/* Summarization Controls */}
          <Box d="flex" pb={2} justifyContent="flex-end">
            {hasUnreadMessages && !isSelectionMode && (
              <Button size="xs" colorScheme="purple" mr={2} onClick={() => handleSummarize("unread")}>
                Summarize Unread
              </Button>
            )}
            {!isSelectionMode ? (
              <Button size="xs" onClick={() => setIsSelectionMode(true)}>
                Select Messages
              </Button>
            ) : (
              <>
                <Button size="xs" colorScheme="teal" mr={2} onClick={() => handleSummarize("selected")} disabled={selectedMessages.length === 0}>
                  Summarize ({selectedMessages.length})
                </Button>
                <Button size="xs" colorScheme="red" mr={2} onClick={handleDelete} disabled={selectedMessages.length === 0}>
                  Delete
                </Button>
                <Button size="xs" onClick={() => { setIsSelectionMode(false); setSelectedMessages([]); }}>
                  Cancel
                </Button>
              </>
            )}
          </Box>

          <Box
            d="flex"
            flexDir="column"
            justifyContent="flex-end"
            p={3}
            bg="transparent"
            w="100%"
            flex={1}
            borderRadius="xl"
            overflowY="hidden"
          >
            {loading ? (
              <Spinner
                size="xl"
                w={20}
                h={20}
                alignSelf="center"
                margin="auto"
              />
            ) : (
              <div className="messages">
                <ScrollableChat
                  messages={messages}
                  isSelectionMode={isSelectionMode}
                  selectedMessages={selectedMessages}
                  onSelectMessage={handleSelectMessage}
                  scrollToMessage={scrollToMessage}
                  setScrollToMessage={setScrollToMessage}
                />
              </div>
            )}

            <FormControl
              onKeyDown={sendMessage}
              id="first-name"
              isRequired
              mt={3}
            >
              {istyping ? (
                <div>
                  <Lottie
                    options={defaultOptions}
                    // height={50}
                    width={70}
                    style={{ marginBottom: 15, marginLeft: 0 }}
                  />
                </div>
              ) : (
                <></>
              )}
              <Input
                variant="unstyled"
                bg="#F3F4F6"
                border="1px solid #E5E7EB"
                borderRadius="full"
                px={5}
                py={3}
                placeholder="Type your message..."
                value={newMessage}
                onChange={typingHandler}
                _focus={{ bg: "white", borderColor: "#C7D2FE", boxShadow: "0 0 0 2px #E0E7FF" }}
              />
            </FormControl>
          </Box>
        </>
      ) : (
        // to get socket.io on same page
          <Box d="flex" alignItems="center" justifyContent="center" h="100%" p={{ base: 4, md: 10 }}>
            <Box
              w="100%"
              maxW="560px"
              bg="white"
              borderRadius="24px"
              p={{ base: 6, md: 8 }}
              boxShadow="0 18px 40px rgba(17,24,39,0.08)"
              border="1px solid #EEF2FF"
              textAlign="center"
            >
              <Box
                w="120px"
                h="120px"
                mx="auto"
                mb={4}
                borderRadius="full"
                bg="linear-gradient(135deg, #6366F1 0%, #A855F7 50%, #22D3EE 100%)"
                d="flex"
                alignItems="center"
                justifyContent="center"
                boxShadow="0 12px 24px rgba(99,102,241,0.25)"
              >
                <Box
                  w="64px"
                  h="46px"
                  bg="white"
                  borderRadius="18px"
                  d="flex"
                  alignItems="center"
                  justifyContent="center"
                  boxShadow="0 8px 18px rgba(17,24,39,0.12)"
                >
                  <HStack spacing={2}>
                    <Box w="8px" h="8px" bg="#6366F1" borderRadius="full" />
                    <Box w="8px" h="8px" bg="#A855F7" borderRadius="full" />
                    <Box w="8px" h="8px" bg="#22D3EE" borderRadius="full" />
                  </HStack>
                </Box>
              </Box>
              <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="700" color="#111827">
                Welcome to <Text as="span" color="#4F46E5">SmartConvo</Text>
              </Text>
              <Text fontSize="sm" color="#6B7280" mt={2}>
                Your intelligent chat companion for conversations, summaries, and quick expense splitting.
              </Text>

              <Box
                mt={6}
                bg="#F8FAFF"
                border="1px solid #EEF2FF"
                borderRadius="16px"
                p={4}
                textAlign="left"
              >
                <Text fontSize="sm" fontWeight="600" color="#4338CA" mb={3}>
                  Try these features:
                </Text>
                <VStack spacing={3} align="stretch">
                  <HStack align="start" spacing={3}>
                    <Box
                      w="28px"
                      h="28px"
                      borderRadius="full"
                      bg="#E0E7FF"
                      d="flex"
                      alignItems="center"
                      justifyContent="center"
                      color="#4338CA"
                    >
                      <i className="fas fa-paper-plane"></i>
                    </Box>
                    <Text fontSize="sm" color="#374151">
                      Send a message to start a conversation
                    </Text>
                  </HStack>
                  <HStack align="start" spacing={3}>
                    <Box
                      w="28px"
                      h="28px"
                      borderRadius="full"
                      bg="#E0E7FF"
                      d="flex"
                      alignItems="center"
                      justifyContent="center"
                      color="#4338CA"
                    >
                      <i className="fas fa-magic"></i>
                    </Box>
                    <Text fontSize="sm" color="#374151">
                      Summarize chats to capture key points
                    </Text>
                  </HStack>
                  <HStack align="start" spacing={3}>
                    <Box
                      w="28px"
                      h="28px"
                      borderRadius="full"
                      bg="#E0E7FF"
                      d="flex"
                      alignItems="center"
                      justifyContent="center"
                      color="#4338CA"
                    >
                      <i className="fas fa-calendar-check"></i>
                    </Box>
                    <Text fontSize="sm" color="#374151">
                      Track deadlines and reminders
                    </Text>
                  </HStack>
                  <HStack align="start" spacing={3}>
                    <Box
                      w="28px"
                      h="28px"
                      borderRadius="full"
                      bg="#E0E7FF"
                      d="flex"
                      alignItems="center"
                      justifyContent="center"
                      color="#4338CA"
                    >
                      <i className="fas fa-coins"></i>
                    </Box>
                    <Text fontSize="sm" color="#374151">
                      Split expenses with your groups
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            </Box>
          </Box>
      )}
      <SummarizeModal isOpen={isSummarizeOpen} onClose={onSummarizeClose} summary={summary} loading={summarizeLoading} />
    </>
  );
};

export default SingleChat;
