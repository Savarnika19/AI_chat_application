import {
  Box,
  Container,
  Image,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from "@chakra-ui/react";
import { useEffect } from "react";
import { useHistory } from "react-router";
import Login from "../components/Authentication/Login";
import Signup from "../components/Authentication/Signup";
import { motion } from "framer-motion";

function Homepage() {
  const history = useHistory();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("userInfo"));

    if (user) history.push("/chats");
  }, [history]);

  const heroImageLeftUrl =
    "https://res.cloudinary.com/ddnzgizrv/image/upload/v1774277141/ChatGPT_Image_Mar_23_2026_08_15_13_PM_vm4kks.png";

  return (
    <Box
      h="100vh"
      bgGradient="linear(to-br, #f2f7ff, #e8f0ff)"
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        top="-140px"
        left="-140px"
        w="360px"
        h="360px"
        bg="rgba(66, 153, 225, 0.3)"
        borderRadius="full"
        filter="blur(12px)"
      />
      <Box
        position="absolute"
        bottom="-140px"
        right="-140px"
        w="360px"
        h="360px"
        bg="rgba(99, 179, 237, 0.18)"
        borderRadius="full"
        filter="blur(10px)"
      />
      <Container
        maxW="100%"
        h="100%"
        px={{ base: 6, md: 12, xl: 20 }}
      >
        <Box
          w="100%"
          h="100%"
          display="grid"
          gridTemplateColumns={{ base: "1fr", lg: "1.3fr 0.7fr" }}
          gap={{ base: 10, lg: 0 }}
          alignItems="center"
          overflow="visible"
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ width: "100%" }}
          >
            <Box position="relative" zIndex={1}>
              <Image
                src={heroImageLeftUrl}
                alt="SmartConvo Illustration"
                maxW={{ base: "100%", md: "92%", lg: "88%" }}
                w="100%"
                objectFit="contain"
                borderRadius="5px"
              />
            </Box>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{ width: "100%" }}
          >
            <Box w="100%" display="flex" justifyContent={{ base: "center", lg: "flex-start" }}>
              <Box
                bg="white"
                w={{ base: "100%", sm: "440px", lg: "420px" }}
                p={{ base: 6, md: 8 }}
                borderRadius="2xl"
                borderWidth="1px"
                borderColor="#03a9fc"
                boxShadow="0 20px 45px rgba(3, 169, 252, 0.25)"
                ml={{ base: 0, lg: "-180px" }}
                mt={{ base: 0, lg: "-40px" }}
                position="relative"
                zIndex={3}
              >
                <Tabs variant="unstyled" isFitted>
                  <TabList
                    bg="blue.50"
                    borderRadius="full"
                    p="2"
                    mb={6}
                  >
                    <Tab
                      borderRadius="full"
                      fontWeight="600"
                      color="blue.700"
                      _selected={{
                        bg: "white",
                        color: "blue.800",
                        boxShadow: "sm",
                      }}
                    >
                      Login
                    </Tab>
                    <Tab
                      borderRadius="full"
                      fontWeight="600"
                      color="blue.700"
                      _selected={{
                        bg: "white",
                        color: "blue.800",
                        boxShadow: "sm",
                      }}
                    >
                      Sign Up
                    </Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel p={0}>
                      <Login />
                    </TabPanel>
                    <TabPanel p={0}>
                      <Signup />
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </Box>
            </Box>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
}

export default Homepage;
