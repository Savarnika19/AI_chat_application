import { Box, Button, Text, VStack, Spinner, Divider, useToast } from "@chakra-ui/react";
import axios from "axios";
import { useState, useEffect } from "react";
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

  const fetchGroups = async () => {
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
  };

  useEffect(() => {
    fetchGroups();
  }, [user]);

  const handleGroupCreated = (newGroup) => {
    history.push(`/expenses/${newGroup._id}`);
  };

  return (
    <div style={{ width: "100%" }}>
      <Box d="flex" justifyContent="space-between" bg="white" w="100%" p="5px 10px 5px 10px" borderWidth="5px">
        <Text fontSize="2xl" fontFamily="Work sans">Talk-A-Tive Expense Splitter</Text>
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
              <Text fontSize="2xl" fontWeight="bold" color="green.500" mb={3}>Active Workspaces</Text>
              {activeGroups.length === 0 ? <Text>No active expense groups yet.</Text> : (
                activeGroups.map(g => (
                  <Box key={g._id} p={4} mb={3} bg="gray.100" borderRadius="md" cursor="pointer" _hover={{ bg: "gray.200" }} onClick={() => history.push(`/expenses/${g._id}`)}>
                    <Text fontWeight="bold" fontSize="lg">Workspace: {g.chat?.chatName || "Chat"}</Text>
                    <Text fontSize="md">Created by: {g.createdBy?.name}</Text>
                  </Box>
                ))
              )}
            </Box>
            
            <Divider />

            <Box>
              <Text fontSize="2xl" fontWeight="bold" color="blue.500" mb={3}>Completed Workspaces</Text>
              {completedGroups.length === 0 ? <Text>No completed expense groups yet.</Text> : (
                completedGroups.map(g => (
                  <Box key={g._id} p={4} mb={3} bg="gray.100" borderRadius="md" cursor="pointer" _hover={{ bg: "gray.200" }} onClick={() => history.push(`/expenses/${g._id}`)}>
                    <Text fontWeight="bold" fontSize="lg">Workspace: {g.chat?.chatName || "Chat"}</Text>
                    <Text fontSize="md">Created by: {g.createdBy?.name}</Text>
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
