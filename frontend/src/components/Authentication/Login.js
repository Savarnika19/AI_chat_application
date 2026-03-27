import { Button } from "@chakra-ui/button";
import { FormControl, FormLabel } from "@chakra-ui/form-control";
import { Input, InputGroup, InputLeftElement, InputRightElement } from "@chakra-ui/input";
import { VStack, Box, Text } from "@chakra-ui/layout";
import { useState } from "react";
import axios from "axios";
import { useToast } from "@chakra-ui/react";
import { useHistory } from "react-router-dom";
import { ChatState } from "../../Context/ChatProvider";
import { EmailIcon, LockIcon } from "@chakra-ui/icons";

const Login = () => {
  const [show, setShow] = useState(false);
  const handleClick = () => setShow(!show);
  const toast = useToast();
  const [email, setEmail] = useState();
  const [password, setPassword] = useState();
  const [loading, setLoading] = useState(false);

  const history = useHistory();
  const { setUser } = ChatState();

  const submitHandler = async () => {
    setLoading(true);
    if (!email || !password) {
      toast({
        title: "Please Fill all the Feilds",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setLoading(false);
      return;
    }

    try {
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };

      const { data } = await axios.post(
        "/api/user/login",
        { email, password },
        config
      );

      toast({
        title: "Login Successful",
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setUser(data);
      localStorage.setItem("userInfo", JSON.stringify(data));
      setLoading(false);
      history.push("/chats");
    } catch (error) {
      toast({
        title: "Error Occured!",
        description: error.response?.data?.message || error.message || "Something went wrong",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setLoading(false);
    }
  };

  return (
    <Box position="relative">
      <VStack spacing="12px" align="stretch">
        <Box>
          <Text fontSize="xl" fontWeight="600" color="gray.700" mb={1}>
            Login to Your Account
          </Text>
          <Text fontSize="sm" color="gray.500">
            Welcome back. Please enter your details.
          </Text>
        </Box>
        <FormControl id="email" isRequired>
          <FormLabel color="gray.700">Email</FormLabel>
          <InputGroup>
            <InputLeftElement pointerEvents="none" color="gray.400">
              <EmailIcon />
            </InputLeftElement>
            <Input
              value={email}
              type="email"
              placeholder="Enter your email"
              onChange={(e) => setEmail(e.target.value)}
              bg="white"
              borderColor="gray.200"
              _placeholder={{ color: "gray.400" }}
              _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #63B3ED" }}
            />
          </InputGroup>
        </FormControl>
        <FormControl id="password" isRequired>
          <FormLabel color="gray.700">Password</FormLabel>
          <InputGroup size="md">
            <InputLeftElement pointerEvents="none" color="gray.400">
              <LockIcon />
            </InputLeftElement>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={show ? "text" : "password"}
              placeholder="Enter password"
              bg="white"
              borderColor="gray.200"
              _placeholder={{ color: "gray.400" }}
              _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #63B3ED" }}
            />
            <InputRightElement width="4.5rem">
              <Button h="1.75rem" size="sm" onClick={handleClick} variant="ghost">
                {show ? "Hide" : "Show"}
              </Button>
            </InputRightElement>
          </InputGroup>
        </FormControl>
        <Button
          alignSelf="flex-end"
          variant="link"
          size="xs"
          color="blue.600"
          _hover={{ color: "blue.700" }}
        >
          Forgot Password?
        </Button>
        <Button
          colorScheme="blue"
          width="100%"
          style={{ marginTop: 15 }}
          onClick={submitHandler}
          isLoading={loading}
          bgGradient="linear(to-r, #2B6CB0, #3182CE)"
          _hover={{
            bgGradient: "linear(to-r, #2C5282, #2B6CB0)",
            transform: "scale(1.02)",
          }}
        >
          Login
        </Button>
        <Button
          variant="outline"
          colorScheme="blue"
          width="100%"
          onClick={() => {
            setEmail("guest@example.com");
            setPassword("123456");
          }}
          _hover={{ bg: "blue.50" }}
        >
          Get Guest User Credentials
        </Button>
      </VStack>
    </Box>
  );
};

export default Login;
