import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  Button, useDisclosure, useToast, Box, Input
} from "@chakra-ui/react";
import axios from "axios";
import { useState } from "react";
import { ChatState } from "../../Context/ChatProvider";
import UserBadgeItem from "../userAvatar/UserBadgeItem";
import UserListItem from "../userAvatar/UserListItem";

const ExpenseGroupCreateModal = ({ children, onGroupCreated }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const { user } = ChatState();
  const toast = useToast();

  const handleOpen = () => {
    // Automatically include the current user in a newly created group
    setSelectedUsers([user]);
    onOpen();
  };

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query) return;

    try {
      setLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`/api/user?search=${search}`, config);
      setLoading(false);
      setSearchResult(data);
    } catch (error) {
      toast({
        title: "Error Occurred!",
        description: "Failed to Load the Search Results",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-left",
      });
      setLoading(false);
    }
  };

  const handleGroup = (userToAdd) => {
    if (selectedUsers.includes(userToAdd)) {
      toast({ title: "User already added", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    setSelectedUsers([...selectedUsers, userToAdd]);
  };

  const handleDelete = (delUser) => {
    if (delUser._id === user._id) return; // Prevent user from deleting themselves
    setSelectedUsers(selectedUsers.filter((sel) => sel._id !== delUser._id));
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) {
      toast({ title: "Insufficient Users", description: "Please add at least one other participant.", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    try {
      setLoading(true);
      const config = { headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` } };

      const { data } = await axios.post(
        "/api/expenses",
        { participants: selectedUsers.map(u => u._id) },
        config
      );

      setLoading(false);
      onClose();
      
      toast({ title: "Group Created", status: "success", duration: 3000, isClosable: true });

      if (onGroupCreated) {
        onGroupCreated(data.expenseGroup, data.notifications);
      }
    } catch (error) {
      toast({ title: "Error Creating Group", description: error.response?.data?.message || error.message, status: "error", duration: 5000, isClosable: true });
      setLoading(false);
    }
  };

  return (
    <>
      <span onClick={handleOpen}>{children}</span>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Shared Group</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Box w="100%" d="flex" flexWrap="wrap" mb={2}>
              {selectedUsers.map((u) => (
                <UserBadgeItem key={u._id} user={u} handleFunction={() => handleDelete(u)} />
              ))}
            </Box>
            
            <Input 
              placeholder="Search Users (eg: Savarnika, Sahithi, Ravi)" 
              mb={3} 
              onChange={(e) => handleSearch(e.target.value)} 
            />

            {loading ? (
              <div>Loading...</div>
            ) : (
              searchResult?.slice(0, 4).map((user) => (
                <UserListItem key={user._id} user={user} handleFunction={() => handleGroup(user)} />
              ))
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleCreateGroup} isLoading={loading}>
              Create Group
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ExpenseGroupCreateModal;
