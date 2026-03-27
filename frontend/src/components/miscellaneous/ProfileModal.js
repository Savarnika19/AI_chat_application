import { ViewIcon } from "@chakra-ui/icons";
import {
  Avatar,
  Box,
  Flex,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  useDisclosure,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";

const ProfileModal = ({ user, children }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      {children ? (
        <span onClick={onOpen}>{children}</span>
      ) : (
        <IconButton d={{ base: "flex" }} icon={<ViewIcon />} onClick={onOpen} />
      )}
      <Modal size="lg" onClose={onClose} isOpen={isOpen} isCentered>
        <ModalOverlay />
        <ModalContent
          borderRadius="2xl"
          overflow="hidden"
          boxShadow="2xl"
          maxW={{ base: "92vw", md: "520px" }}
        >
          <ModalHeader p={0}>
            <Box
              px={{ base: 5, md: 6 }}
              py={{ base: 5, md: 6 }}
              bg="linear-gradient(135deg, #E7F0FF 0%, #FFFFFF 70%)"
            >
              <Flex align="center" gap={4}>
                <Avatar
                  name={user.name}
                  src={user.pic}
                  size="xl"
                  border="3px solid white"
                />
                <Box>
                  <Text
                    fontSize={{ base: "2xl", md: "3xl" }}
                    fontWeight="700"
                    color="gray.800"
                    fontFamily="Work sans"
                    lineHeight="1.1"
                  >
                    {user.name}
                  </Text>
                </Box>
              </Flex>
            </Box>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody px={{ base: 5, md: 6 }} py={{ base: 5, md: 6 }}>
            <VStack align="stretch" spacing={3}>
              <Box>
                <Text
                  fontSize="xs"
                  letterSpacing="0.08em"
                  textTransform="uppercase"
                  color="gray.500"
                  mb={1}
                >
                  Contact
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Primary email
                </Text>
                <Text fontSize="md" fontWeight="600" color="gray.800">
                  {user.email}
                </Text>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter px={{ base: 5, md: 6 }} pb={{ base: 5, md: 6 }}>
            <Button onClick={onClose} colorScheme="blue">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ProfileModal;
