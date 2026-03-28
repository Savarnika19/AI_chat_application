import { Box, Button, Text, VStack, Spinner, Divider, useToast } from "@chakra-ui/react";
import axios from "axios";
import { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { ChatState } from "../Context/ChatProvider";
import ExpenseGroupCreateModal from "../components/miscellaneous/ExpenseGroupCreateModal";

const ExpenseDashboardPage = () => {
  const [activeGroups, setActiveGroups] = useState([]);
  const [completedGroups, setCompletedGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const { user } = ChatState();
  const toast = useToast();
  const history = useHistory();

  const fetchGroups = useCallback(async () => {
    if (!user || !user.token) return;
    try {
      setLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get("/api/expenses", config);
      setActiveGroups(data.active);
      setCompletedGroups(data.completed);
      setLoading(false);
    } catch (error) {
      toast({
        title: "Error fetching expense groups",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleGroupCreated = (newGroup) => {
    history.push(`/expenses/${newGroup._id}`);
  };

  const handleDeleteGroup = async (groupId, event) => {
    event?.stopPropagation();
    if (!window.confirm("Delete this expense group? This cannot be undone.")) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`/api/expenses/${groupId}`, config);
      toast({ title: "Expense group deleted", status: "success", duration: 3000, isClosable: true });
      fetchGroups();
    } catch (error) {
      toast({
        title: "Error deleting group",
        description: error.response?.data?.message || error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <Box d="flex" justifyContent="space-between" bg="white" w="100%" p="5px 10px 5px 10px" borderWidth="5px">
        <Text fontSize="2xl" fontFamily="Outfit" fontWeight="600">
          SmartConvo Expense Splitter
        </Text>
        <Box>
          <Button variant="ghost" mr={2} onClick={() => history.push("/chats")}>Back to Chats</Button>
          <ExpenseGroupCreateModal onGroupCreated={handleGroupCreated}>
            <Button colorScheme="blue">Create Group</Button>
          </ExpenseGroupCreateModal>
        </Box>
      </Box>

      <Box p={6} mt={4} maxW="container.md" mx="auto" bg="white" borderRadius="lg" borderWidth="1px">
        <Text fontSize="3xl" mb={4} textAlign="center">Expense Dashboard</Text>
        {loading ? (
          <Spinner size="xl" d="block" mx="auto" my={10} />
        ) : (
          <VStack align="stretch" spacing={6}>
            <Box>
              <Text fontSize="2xl" fontWeight="bold" color="green.500" mb={3}>Active Groups</Text>
              {activeGroups.length === 0 ? <Text>No active expense groups yet.</Text> : (
                activeGroups.map(g => (
                  <Box
                    key={g._id}
                    p={4}
                    mb={3}
                    bg="gray.100"
                    borderRadius="md"
                    cursor="pointer"
                    _hover={{ bg: "gray.200" }}
                    onClick={() => history.push(`/expenses/${g._id}`)}
                    d="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={4}
                  >
                    <Box>
                      <Text fontWeight="bold" fontSize="lg">Group: {g.chat?.chatName || "Chat"}</Text>
                      <Text fontSize="md">Created by: {g.createdBy?.name}</Text>
                    </Box>
                    <Button colorScheme="red" size="sm" onClick={(e) => handleDeleteGroup(g._id, e)}>
                      Delete
                    </Button>
                  </Box>
                ))
              )}
            </Box>
            
            <Divider />

            <Box>
              <Text fontSize="2xl" fontWeight="bold" color="blue.500" mb={3}>Completed Groups</Text>
              {completedGroups.length === 0 ? <Text>No completed expense groups yet.</Text> : (
                completedGroups.map(g => (
                  <Box
                    key={g._id}
                    p={4}
                    mb={3}
                    bg="gray.100"
                    borderRadius="md"
                    cursor="pointer"
                    _hover={{ bg: "gray.200" }}
                    onClick={() => history.push(`/expenses/${g._id}`)}
                    d="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={4}
                  >
                    <Box>
                      <Text fontWeight="bold" fontSize="lg">Group: {g.chat?.chatName || "Chat"}</Text>
                      <Text fontSize="md">Created by: {g.createdBy?.name}</Text>
                    </Box>
                    <Button colorScheme="red" size="sm" onClick={(e) => handleDeleteGroup(g._id, e)}>
                      Delete
                    </Button>
                  </Box>
                ))
              )}
            </Box>
          </VStack>
        )}
      </Box>
    </div>
  );
};

export default ExpenseDashboardPage;
