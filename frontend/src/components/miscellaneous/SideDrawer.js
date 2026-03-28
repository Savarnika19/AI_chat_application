import { Button } from "@chakra-ui/button";
import { useDisclosure } from "@chakra-ui/hooks";
import { Input } from "@chakra-ui/input";
import { Box, Text } from "@chakra-ui/layout";
import {
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
} from "@chakra-ui/menu";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from "@chakra-ui/modal";
import { Tooltip } from "@chakra-ui/tooltip";
import { BellIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { Avatar } from "@chakra-ui/avatar";
import { useHistory } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { useToast } from "@chakra-ui/toast";
import ChatLoading from "../ChatLoading";
import { Spinner } from "@chakra-ui/spinner";
import ProfileModal from "./ProfileModal";
import { getSender } from "../../config/ChatLogics";
import UserListItem from "../userAvatar/UserListItem";
import { ChatState } from "../../Context/ChatProvider";
import GlobalDeadlineDrawer from "../GlobalDeadlineDrawer";

function SideDrawer() {
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  const {
    setSelectedChat,
    user,
    notification,
    setNotification,
    dbNotifications,
    setDbNotifications,
    chats,
    setChats,
  } = ChatState();

  useEffect(() => {
    const fetchDbNotifications = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const { data } = await axios.get("/api/notifications", config);
        // Only keep unread notifications
        setDbNotifications(data.filter((n) => !n.isRead));
      } catch (error) {
        console.error("Failed to fetch expense notifications:", error);
      }
    };
    if (user) {
      fetchDbNotifications();
    }
  }, [user, setDbNotifications]);

  const toast = useToast();
  const { isOpen, onClose } = useDisclosure();
  const { isOpen: isDeadlineOpen, onOpen: onDeadlineOpen, onClose: onDeadlineClose } = useDisclosure();
  const history = useHistory();

  const logoutHandler = () => {
    localStorage.removeItem("userInfo");
    history.push("/");
  };

  const handleSearch = async () => {
    if (!search) {
      toast({
        title: "Please Enter something in search",
        status: "warning",
        duration: 5000,
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

      setLoading(false);
      setSearchResult(data);
    } catch (error) {
      toast({
        title: "Error Occured!",
        description: "Failed to Load the Search Results",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-left",
      });
    }
  };

  const accessChat = async (userId) => {
    console.log(userId);

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
      onClose();
    } catch (error) {
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
    <>
      <Box position="sticky" top="0" zIndex="10" w="100%" py={3}>
        <Box
          d="flex"
          alignItems="center"
          bg="white"
          w="100%"
          px={{ base: 3, md: 5 }}
          py={3}
          borderRadius="16px"
          boxShadow="0 10px 24px rgba(17,24,39,0.08)"
        >
          <Box d="flex" alignItems="center" gap={3} minW="170px">
            <Box
              w="36px"
              h="36px"
              borderRadius="12px"
              bg="linear-gradient(135deg, #6366F1 0%, #22D3EE 100%)"
              d="flex"
              alignItems="center"
              justifyContent="center"
              color="white"
            >
              <i className="fas fa-comment-dots"></i>
            </Box>
            <Text fontSize="lg" fontWeight="700" fontFamily="Outfit">
              SmartConvo
            </Text>
          </Box>
          <Box flex="1" />

          <Box d="flex" alignItems="center" gap={2}>
            <Tooltip label="Deadlines Tracker" hasArrow placement="bottom">
              <Button
                variant="ghost"
                onClick={onDeadlineOpen}
                borderRadius="full"
                transition="all 0.2s ease"
                _hover={{ bg: "#EEF2FF", transform: "scale(1.05)" }}
              >
                <i className="fas fa-calendar-check"></i>
              </Button>
            </Tooltip>

            <Tooltip label="Expense Dashboard" hasArrow placement="bottom">
              <Button
                onClick={() => history.push("/expenses")}
                bg="#EEF2FF"
                color="#4338CA"
                borderRadius="full"
                px={4}
                fontWeight="600"
                fontSize="sm"
                transition="all 0.2s ease"
                _hover={{ bg: "#E0E7FF" }}
              >
                <i className="fas fa-coins" style={{ marginRight: 8 }}></i>
                Expense Splitter
              </Button>
            </Tooltip>

            <Menu>
              <MenuButton p={1}>
                <Box position="relative" display="inline-block">
                  <BellIcon fontSize="2xl" m={1} />
                  {(notification.length + dbNotifications.length) > 0 && (
                    <Box
                      color="white"
                      bg="#EF4444"
                      borderRadius="full"
                      border="2px solid #FFFFFF"
                      boxShadow="0 2px 6px rgba(0,0,0,0.12)"
                      position="absolute"
                      top="-2px"
                      right="-2px"
                      fontSize="xs"
                      w="18px"
                      h="18px"
                      d="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      {notification.length + dbNotifications.length}
                    </Box>
                  )}
                </Box>
              </MenuButton>
              <MenuList pl={2}>
                {!notification.length && !dbNotifications.length && "No Notifications"}
                {notification.map((notif) => (
                  <MenuItem
                    key={notif._id}
                    onClick={() => {
                      if (notif.type === "expense_created" || notif.type === "expense_settlement") {
                        const groupId = notif.expenseGroup?._id || notif.expenseGroup;
                        history.push(`/expenses/${groupId}`);
                      } else if (notif.chat) {
                        setSelectedChat(notif.chat);
                      }
                      setNotification(notification.filter((n) => n._id !== notif._id));
                    }}
                  >
                    {notif.type && notif.type.startsWith("expense_") ? (
                      <><Text as="span" fontWeight="bold" mr={2}><i className="fas fa-coins"></i></Text> {notif.message}</>
                    ) : notif.chat?.isGroupChat ? (
                      `New Message in ${notif.chat.chatName}`
                    ) : (
                      `New Message from ${getSender(user, notif.chat?.users)}`
                    )}
                  </MenuItem>
                ))}
                {dbNotifications.map((notif) => (
                  <MenuItem
                    key={notif._id}
                    onClick={async () => {
                      try {
                        const config = { headers: { Authorization: `Bearer ${user.token}` } };
                        await axios.patch(`/api/notifications/${notif._id}`, {}, config);
                        setDbNotifications(dbNotifications.filter((n) => n._id !== notif._id));
                        setNotification(notification.filter((n) => n._id !== notif._id));

                        // Handling logic for opening Expense View
                        if (notif.type === "expense_created" || notif.type === "expense_settlement") {
                          const groupId = notif.expenseGroup?._id || notif.expenseGroup;
                          history.push(`/expenses/${groupId}`);
                        }
                      } catch (error) {
                        console.log(error);
                      }
                    }}
                  >
                    <Text as="span" fontWeight="bold" mr={2}><i className="fas fa-coins"></i></Text> {notif.message}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>

            <Menu>
              <MenuButton
                as={Button}
                bg="white"
                rightIcon={<ChevronDownIcon />}
                borderRadius="full"
                transition="all 0.2s ease"
                _hover={{ bg: "#EEF2FF", transform: "scale(1.02)" }}
              >
                <Avatar
                  size="sm"
                  cursor="pointer"
                  name={user.name}
                  src={user.pic}
                />
              </MenuButton>
              <MenuList>
                <ProfileModal user={user}>
                  <MenuItem>My Profile</MenuItem>{" "}
                </ProfileModal>
                <MenuDivider />
                <MenuItem onClick={logoutHandler}>Logout</MenuItem>
              </MenuList>
            </Menu>
          </Box>
        </Box>
      </Box>

      <Drawer placement="left" onClose={onClose} isOpen={isOpen}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerHeader borderBottomWidth="1px">Search Users</DrawerHeader>
          <DrawerBody>
            <Box d="flex" pb={2}>
              <Input
                placeholder="Search by name or email"
                mr={2}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button onClick={handleSearch}>Go</Button>
            </Box>
            {loading ? (
              <ChatLoading />
            ) : (
              searchResult?.map((user) => (
                <UserListItem
                  key={user._id}
                  user={user}
                  handleFunction={() => accessChat(user._id)}
                />
              ))
            )}
            {loadingChat && <Spinner ml="auto" d="flex" />}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <GlobalDeadlineDrawer isOpen={isDeadlineOpen} onClose={onDeadlineClose} />
    </>
  );
}

export default SideDrawer;


