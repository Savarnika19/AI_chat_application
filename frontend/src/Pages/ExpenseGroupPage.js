import { Box, Button, Text, VStack, Spinner, Input, FormControl, FormLabel, useToast, HStack } from "@chakra-ui/react";
import axios from "axios";
import { useState, useEffect } from "react";
import { useParams, useHistory } from "react-router-dom";
import { ChatState } from "../Context/ChatProvider";

const ExpenseGroupPage = () => {
  const { groupId } = useParams();
  const history = useHistory();
  const { user } = ChatState();
  const toast = useToast();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [amounts, setAmounts] = useState({});

  const fetchGroup = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`/api/expenses/${groupId}`, config);
      setGroup(data);
      setLoading(false);
    } catch (error) {
      toast({ title: "Error fetching group", status: "error", duration: 3000, isClosable: true });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  const handleSavePayment = async (targetUserId) => {
    const amount = amounts[targetUserId];
    if (amount === undefined || amount === "" || Number(amount) < 0) {
      toast({ title: "Invalid amount", status: "warning", duration: 3000, isClosable: true });
      return;
    }

    try {
      setSubmittingId(targetUserId);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(`/api/expenses/${groupId}/submit`, { targetUserId, amount: Number(amount) }, config);
      
      // Setting group replaces the entire layout and locks the row
      setGroup(data.expenseGroup);
      setSubmittingId(null);
      toast({ title: "Payment logged", status: "success", duration: 2000, isClosable: true });
    } catch (error) {
      setSubmittingId(null);
      toast({ title: "Error Saving", description: error.response?.data?.message || error.message, status: "error", duration: 3000, isClosable: true });
    }
  };

  const handleCalculate = async () => {
    try {
      setCalculating(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      
      // Finish forces zeros on any empty inputs inherently, and fires our notifications
      const { data } = await axios.post(`/api/expenses/${groupId}/finish`, {}, config);
      setGroup(data.expenseGroup);
      setCalculating(false);
    } catch (error) {
      setCalculating(false);
      toast({ title: "Error Calculating", description: error.response?.data?.message || error.message, status: "error", duration: 3000, isClosable: true });
    }
  };

  if (loading || !group) return <Spinner size="xl" d="block" mx="auto" my={20} />;

  return (
    <Box p={6} mt={4} maxW="container.md" mx="auto" bg="white" borderRadius="lg" borderWidth="1px">
      <Button mb={4} onClick={() => history.push("/expenses")}>Back to Dashboard</Button>
      <Text fontSize="3xl" mb={4} textAlign="center">Shared Expense Workspace</Text>
      
      {group.status === "active" ? (
        <VStack spacing={4} align="stretch" mb={6}>
          <Text fontSize="lg" color="gray.600" mb={4}>Anyone can log payments for any participant. Once saved, entries are locked.</Text>
          {group.participants.map(p => {
            const hasPaid = group.payments.some(pay => pay.user.toString() === p._id.toString() || pay.user._id === p._id);
            const paymentObj = group.payments.find(pay => pay.user.toString() === p._id.toString() || pay.user._id === p._id);

            if (hasPaid) {
              return (
                <HStack key={p._id} spacing={4}>
                  <Text w="150px" fontWeight="bold">{p.name}</Text>
                  <FormControl w="150px">
                    <Input type="number" value={paymentObj.amount} isDisabled />
                  </FormControl>
                  <Text color="green.500" fontWeight="bold">Locked</Text>
                </HStack>
              );
            } else {
              return (
                <HStack key={p._id} spacing={4}>
                  <Text w="150px">{p.name}</Text>
                  <FormControl w="150px">
                    <Input 
                      placeholder="0" 
                      type="number" 
                      value={amounts[p._id] || ""} 
                      onChange={(e) => setAmounts({ ...amounts, [p._id]: e.target.value })} 
                      isDisabled={submittingId === p._id || calculating}
                    />
                  </FormControl>
                  <Button colorScheme="blue" size="sm" onClick={() => handleSavePayment(p._id)} isLoading={submittingId === p._id} isDisabled={submittingId !== null || calculating}>
                    Save
                  </Button>
                </HStack>
              );
            }
          })}
          
          <Button colorScheme="red" mt={8} w="100%" onClick={handleCalculate} isLoading={calculating} isDisabled={submittingId !== null}>
            Calculate Settlements
          </Button>
        </VStack>
      ) : (
        <VStack spacing={4} align="stretch">
          <Text fontSize="2xl" fontWeight="bold" color="teal.500" textAlign="center">Group Completed 🎉</Text>
          <Box p={4} bg="gray.100" borderRadius="md">
            <Text fontWeight="bold" fontSize="lg" mb={2}>Who Paid What:</Text>
            {group.payments.map((p, idx) => {
              const participant = group.participants.find(part => part._id === p.user.toString() || part._id === p.user._id);
              return <Text key={idx}>- {participant?.name || p.user?.name || "User"}: ₹{p.amount}</Text>;
            })}
          </Box>
          <Box p={4} bg="gray.100" borderRadius="md">
            <Text fontWeight="bold" fontSize="lg" mb={2}>Final Settlements:</Text>
            {group.settlements.length === 0 ? (
              <Text>Everything is settled! No payments required.</Text>
            ) : (
              group.settlements.map((s, idx) => {
                const fromP = group.participants.find(p => p._id === s.from.toString());
                const toP = group.participants.find(p => p._id === s.to.toString());
                return (
                  <Text key={idx} mb={1}>
                    <b>{fromP?.name || s.fromName}</b> should pay ₹<b>{s.amount.toFixed(2)}</b> to <b>{toP?.name || s.toName}</b>
                  </Text>
                );
              })
            )}
          </Box>
        </VStack>
      )}
    </Box>
  );
};

export default ExpenseGroupPage;
