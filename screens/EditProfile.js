import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import {
  updateProfile,
} from "firebase/auth";

import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import {
  auth,
  storage,
} from "../utils/firebase";

import {
  getUser,
  updateUser,
} from "../providers/rest";

import BottomNavbar from "../components/BottomNavbar";
import Sidebar from "../components/Sidebar";

import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const BOTTOM_NAV_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 760;

const AVATAR_SIZE = 512;

const FALLBACK_AVATAR =
  require("../images/avatarIcon.png");

export default function EditProfile({
  navigation,
}) {
  const { width } = useWindowDimensions();

  const isWeb =
    Platform.OS === "web";

  const isDesktopWeb =
    isWeb &&
    width >= DESKTOP_BREAKPOINT;

  const isMobileWeb =
    isWeb &&
    width < DESKTOP_BREAKPOINT;

  const isCompact =
    width < 600;

  const [username, setUsername] =
    useState("");

  const [
    originalUsername,
    setOriginalUsername,
  ] = useState("");

  const [email, setEmail] =
    useState("");

  const [avatar, setAvatar] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    uploadingAvatar,
    setUploadingAvatar,
  ] = useState(false);

  const [isPublic, setIsPublic] =
    useState(true);

  const [menuOpen, setMenuOpen] =
    useState(false);

  /*
   * Keep the sidebar permanently open on desktop.
   */
  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  }, [isDesktopWeb]);

  /*
   * Safely parse backend responses.
   */
  const parseResponse = useCallback(
    async (
      response,
      fallbackMessage
    ) => {
      if (!response) {
        throw new Error(
          "The backend returned no response."
        );
      }

      const responseText =
        await response.text();

      let data = {};

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        data = {
          error:
            responseText ||
            "The backend returned an invalid response.",
        };
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `${fallbackMessage} HTTP ${response.status}`
        );
      }

      return data;
    },
    []
  );

  /*
   * Load the current profile.
   */
  const fetchUserData =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setLoading(false);

        navigation.navigate(
          "Home"
        );

        return;
      }

      try {
        setLoading(true);

        const response =
          await getUser(
            currentUser.uid
          );

        const userData =
          await parseResponse(
            response,
            "Unable to load your profile."
          );

        const finalUsername =
          userData?.username ||
          currentUser.displayName ||
          "";

        const finalEmail =
          userData?.email ||
          currentUser.email ||
          "";

        const backendAvatar =
          userData?.avatar &&
          userData.avatar !== "None"
            ? userData.avatar
            : null;

        const finalAvatar =
          backendAvatar ||
          currentUser.photoURL ||
          null;

        const publicValue =
          userData?.isPublic;

        setUsername(
          finalUsername
        );

        setOriginalUsername(
          finalUsername
        );

        setEmail(finalEmail);

        setAvatar(finalAvatar);

        setIsPublic(
          publicValue === true ||
            publicValue ===
              "true" ||
            publicValue === 1 ||
            publicValue ===
              undefined
        );
      } catch (error) {
        console.error(
          "[EditProfile] Load error:",
          error
        );

        Alert.alert(
          "Unable to load profile",
          error?.message ||
            "Please try again."
        );
      } finally {
        setLoading(false);
      }
    }, [
      navigation,
      parseResponse,
    ]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData])
  );

  /*
   * Convert the selected image to a Blob.
   */
  const createImageBlob =
    useCallback(async (uri) => {
      if (!uri) {
        throw new Error(
          "The selected image does not have a valid file location."
        );
      }

      const response =
        await fetch(uri);

      if (!response.ok) {
        throw new Error(
          "Unable to read the selected image."
        );
      }

      return response.blob();
    }, []);

  /*
   * Resize and crop the avatar to a square.
   */
  const prepareAvatar =
    useCallback(async (asset) => {
      if (!asset?.uri) {
        throw new Error(
          "No image was selected."
        );
      }

      const imageWidth =
        Number(asset.width) ||
        AVATAR_SIZE;

      const imageHeight =
        Number(asset.height) ||
        AVATAR_SIZE;

      const shortestSide =
        Math.min(
          imageWidth,
          imageHeight
        );

      const originX =
        Math.max(
          (
            imageWidth -
            shortestSide
          ) / 2,
          0
        );

      const originY =
        Math.max(
          (
            imageHeight -
            shortestSide
          ) / 2,
          0
        );

      return ImageManipulator.manipulateAsync(
        asset.uri,
        [
          {
            crop: {
              originX,
              originY,
              width:
                shortestSide,
              height:
                shortestSide,
            },
          },
          {
            resize: {
              width:
                AVATAR_SIZE,
              height:
                AVATAR_SIZE,
            },
          },
        ],
        {
          compress: 0.85,
          format:
            ImageManipulator
              .SaveFormat.JPEG,
        }
      );
    }, []);

  /*
   * Upload an avatar to Firebase Storage and update OrientDB.
   */
  const uploadAvatarToFirebase =
  useCallback(
    async (asset) => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        throw new Error(
          "No user is logged in."
        );
      }

      try {
        setUploadingAvatar(true);

        const preparedImage =
          await prepareAvatar(asset);

        const blob =
          await createImageBlob(
            preparedImage.uri
          );

        const storageReference =
          ref(
            storage,
            `avatars/${currentUser.uid}.jpg`
          );

        await uploadBytes(
          storageReference,
          blob,
          {
            contentType:
              "image/jpeg",
            cacheControl:
              "public,max-age=3600",
          }
        );

        const downloadURL =
          await getDownloadURL(
            storageReference
          );

        /*
         * Add a version parameter so browsers do not
         * continue showing the old cached avatar.
         */
        const avatarURL =
          `${downloadURL}${
            downloadURL.includes("?")
              ? "&"
              : "?"
          }updated=${Date.now()}`;

        /*
         * Save the avatar in the Treble backend.
         */
        const updateResponse =
          await updateUser(
            currentUser.uid,
            {
              avatar: avatarURL,
            }
          );

        await parseResponse(
          updateResponse,
          "Unable to save the avatar."
        );

        /*
         * Also save it to Firebase Authentication.
         */
        await updateProfile(
          currentUser,
          {
            photoURL: avatarURL,
          }
        );

        /*
         * Update the picture immediately on this page.
         */
        setAvatar(avatarURL);

        if (
          Platform.OS === "web"
        ) {
          window.alert(
            "Your profile picture was updated successfully."
          );
        } else {
          Alert.alert(
            "Avatar updated",
            "Your profile picture was updated successfully."
          );
        }
      } catch (error) {
        console.error(
          "[EditProfile] Avatar upload error:",
          error
        );

        const message =
          error?.message ||
          "Please try another image.";

        if (
          Platform.OS === "web"
        ) {
          window.alert(
            `Unable to update avatar: ${message}`
          );
        } else {
          Alert.alert(
            "Unable to update avatar",
            message
          );
        }
      } finally {
        setUploadingAvatar(false);
      }
    },
    [
      createImageBlob,
      parseResponse,
      prepareAvatar,
    ]
  );
  /*
   * Open the image picker.
   */
  const handlePickAvatar =
    useCallback(async () => {
      if (uploadingAvatar) {
        return;
      }

      try {
        if (
          Platform.OS !== "web"
        ) {
          const permissionResult =
            await ImagePicker.requestMediaLibraryPermissionsAsync();

          if (
            !permissionResult.granted
          ) {
            Alert.alert(
              "Permission required",
              "Treble needs access to your photo library to update your avatar."
            );

            return;
          }
        }

        const result =
          await ImagePicker.launchImageLibraryAsync(
            {
              mediaTypes:
                ImagePicker
                  .MediaTypeOptions
                  .Images,

              allowsEditing: true,

              aspect: [1, 1],

              quality: 0.9,
            }
          );

        if (
          result.canceled ||
          !result.assets?.length
        ) {
          return;
        }

        await uploadAvatarToFirebase(
          result.assets[0]
        );
      } catch (error) {
        console.error(
          "[EditProfile] Image picker error:",
          error
        );

        Alert.alert(
          "Unable to select image",
          error?.message ||
            "Please try again."
        );
      }
    }, [
      uploadAvatarToFirebase,
      uploadingAvatar,
    ]);

  /*
   * Save username and privacy settings.
   */
  const handleSave =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        Alert.alert(
          "Not signed in",
          "Please sign in again."
        );

        navigation.navigate(
          "Home"
        );

        return;
      }

      const newUsername =
        username.trim();

      if (!newUsername) {
        Alert.alert(
          "Username required",
          "Please enter a username."
        );

        return;
      }

      if (
        newUsername.length < 3
      ) {
        Alert.alert(
          "Username too short",
          "Your username must contain at least three characters."
        );

        return;
      }

      if (
        newUsername.length > 30
      ) {
        Alert.alert(
          "Username too long",
          "Your username must contain 30 characters or fewer."
        );

        return;
      }

      if (
        !/^[a-z0-9._-]+$/i.test(
          newUsername
        )
      ) {
        Alert.alert(
          "Invalid username",
          "Use only letters, numbers, periods, underscores, or hyphens."
        );

        return;
      }

      try {
        setSaving(true);

        const payload = {
          username:
            newUsername,

          isPublic:
            Boolean(isPublic),
        };

        if (
          typeof avatar === "string" &&
          avatar.trim()
        ) {
          payload.avatar =
            avatar.trim();
        }

        const response =
          await updateUser(
            currentUser.uid,
            payload
          );

        await parseResponse(
          response,
          "Unable to update your profile."
        );

        if (
          currentUser.displayName !==
          newUsername
        ) {
          await updateProfile(
            currentUser,
            {
              displayName:
                newUsername,
            }
          );
        }

        setUsername(
          newUsername
        );

        setOriginalUsername(
          newUsername
        );

        Alert.alert(
          "Profile updated",
          "Your profile was updated successfully.",
          [
            {
              text: "OK",
              onPress: () =>
                navigation.navigate(
                  "Profile"
                ),
            },
          ]
        );
      } catch (error) {
        console.error(
          "[EditProfile] Save error:",
          error
        );

        Alert.alert(
          "Unable to save profile",
          error?.message ||
            "Please try again."
        );
      } finally {
        setSaving(false);
      }
    }, [
      avatar,
      isPublic,
      navigation,
      parseResponse,
      username,
    ]);

  const avatarSource =
    avatar &&
    typeof avatar ===
      "string" &&
    (
      avatar.startsWith(
        "data:"
      ) ||
      avatar.startsWith(
        "http://"
      ) ||
      avatar.startsWith(
        "https://"
      )
    )
      ? {
          uri: avatar,
        }
      : FALLBACK_AVATAR;

    const hasChanges =
    username.trim() !==
    originalUsername.trim();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator
          size="large"
          color={
            colours.lightblue
          }
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isWeb &&
          styles.webContainer,
      ]}
    >
      {/* =====================================================
          SIDEBAR
      ===================================================== */}
      <View
        style={[
          styles.sideMenu,
          isDesktopWeb &&
            styles.desktopSideMenu,
          isMobileWeb &&
            styles.mobileSideMenu,
        ]}
        pointerEvents="box-none"
      >
        <Sidebar
          menuOpen={
            isDesktopWeb
              ? true
              : menuOpen
          }
          setMenuOpen={
            isDesktopWeb
              ? () => {}
              : setMenuOpen
          }
          isDesktop={
            isDesktopWeb
          }
        />
      </View>

      {/* =====================================================
          PAGE CONTENT
      ===================================================== */}
      <View
        style={[
          styles.pageContent,
          isDesktopWeb &&
            styles.desktopPageContent,
          isMobileWeb &&
            styles.mobilePageContent,
        ]}
      >
        <ScrollView
          style={[
            styles.profileScroll,
            isWeb &&
              styles.webProfileScroll,
          ]}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktopWeb &&
              styles.desktopScrollContent,
          ]}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* PAGE TITLE */}
          <View
            style={
              styles.pageHeader
            }
          >
            <Text
              style={
                styles.pageTitle
              }
            >
              Edit Profile
            </Text>

            <Text
              style={
                styles.pageDescription
              }
            >
              Update your account details, profile picture, and privacy settings.
            </Text>
          </View>

          {/* AVATAR CARD */}
          <View
            style={[
              styles.profileHeader,
              isCompact &&
                styles.compactProfileHeader,
            ]}
          >
            <TouchableOpacity
              style={
                styles.avatarButton
              }
              onPress={
                handlePickAvatar
              }
              disabled={
                uploadingAvatar
              }
              activeOpacity={0.8}
            >
              <Image
                key={
                  typeof avatar === "string"
                    ? avatar
                    : "fallback-avatar"
                }
                source={avatarSource}
                style={styles.avatar}
                onError={(event) => {
                  console.error(
                    "[EditProfile] Avatar display error:",
                    event?.nativeEvent?.error
                  );
                }}
              />

              <View
                style={
                  styles.avatarOverlay
                }
              >
                {uploadingAvatar ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />
                ) : (
                  <Text
                    style={
                      styles.avatarOverlayText
                    }
                  >
                    Edit
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            <View
              style={
                styles.headerInfo
              }
            >
              <Text
                style={
                  styles.profileHeading
                }
              >
                Profile Picture
              </Text>

              <Text
                style={
                  styles.editInfoText
                }
              >
                Select a square image. It will be cropped and resized automatically.
              </Text>

              <TouchableOpacity
                style={[
                  styles.changePhotoButton,
                  uploadingAvatar &&
                    styles.disabledButton,
                ]}
                onPress={
                  handlePickAvatar
                }
                disabled={
                  uploadingAvatar
                }
              >
                <Text
                  style={
                    styles.changePhotoButtonText
                  }
                >
                  {uploadingAvatar
                    ? "Uploading..."
                    : "Change Photo"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ACCOUNT DETAILS */}
          <View
            style={
              styles.formCard
            }
          >
            <Text
              style={
                styles.cardTitle
              }
            >
              Account Details
            </Text>

            <Text
              style={
                styles.cardDescription
              }
            >
              Choose the username displayed throughout Treble.
            </Text>

            <View
              style={
                styles.inputSection
              }
            >
              <Text
                style={
                  styles.label
                }
              >
                Username
              </Text>

              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="words"
                autoCorrect={false}
                spellCheck={false}
                maxLength={30}
                editable={!saving}
                returnKeyType="done"
              />

              <Text
                style={
                  styles.inputHelper
                }
              >
                Letters, numbers, periods, underscores, and hyphens only.
              </Text>
            </View>

            <View
              style={
                styles.inputSection
              }
            >
              <Text
                style={
                  styles.label
                }
              >
                Email
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.disabledInput,
                ]}
                value={email}
                editable={false}
                selectTextOnFocus={
                  false
                }
              />

              <Text
                style={
                  styles.inputHelper
                }
              >
                Your email address cannot be changed from this page.
              </Text>
            </View>
          </View>

          {/* PRIVACY */}
          <View
            style={
              styles.privacyCard
            }
          >
            <View
              style={
                styles.privacyTextContainer
              }
            >
              <Text
                style={
                  styles.privacyTitle
                }
              >
                Profile Privacy
              </Text>

              <Text
                style={
                  styles.privacySubtitle
                }
              >
                Public profiles can be followed immediately. Private profiles require approval.
              </Text>
            </View>

            <View
              style={
                styles.privacyRow
              }
            >
              <View
                style={
                  styles.privacyStatusContainer
                }
              >
                <Text
                  style={
                    styles.privacyLabel
                  }
                >
                  {isPublic
                    ? "Public Profile"
                    : "Private Profile"}
                </Text>

                <Text
                  style={
                    styles.privacyStatusDescription
                  }
                >
                  {isPublic
                    ? "Anyone can follow your account."
                    : "You approve each follow request."}
                </Text>
              </View>

              <Switch
                value={isPublic}
                onValueChange={
                  setIsPublic
                }
                disabled={saving}
                trackColor={{
                  false:
                    "rgba(255,255,255,0.18)",
                  true:
                    colours.lightblue,
                }}
                thumbColor="#ffffff"
                ios_backgroundColor="rgba(255,255,255,0.18)"
              />
            </View>
          </View>

          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              (
                saving ||
                uploadingAvatar
              ) &&
                styles.disabledButton,
            ]}
            onPress={
              handleSave
            }
            disabled={
              saving ||
              uploadingAvatar
            }
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color="#ffffff"
              />
            ) : (
              <Text
                style={
                  styles.saveButtonText
                }
              >
                Save Changes
              </Text>
            )}
          </TouchableOpacity>

          {hasChanges ? (
            <Text
              style={
                styles.unsavedText
              }
            >
              You have unsaved username changes.
            </Text>
          ) : null}
        </ScrollView>
      </View>

      {/* =====================================================
          BOTTOM NAVIGATION
      ===================================================== */}
      <View
        style={[
          styles.bottomNavBar,
          isDesktopWeb &&
            styles.desktopBottomNavBar,
        ]}
      >
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* =====================================================
     PAGE
  ===================================================== */

  container: {
    flex: 1,
    minHeight: 0,

    backgroundColor:
      colours.background,
  },

  webContainer: {
    width: "100%",
    height: "100vh",

    minHeight: 0,

    overflow: "hidden",
  },

  loader: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      colours.background,
  },

  loadingText: {
    color:
      "rgba(255,255,255,0.65)",

    fontSize: 14,

    marginTop: 12,
  },

  /* =====================================================
     SIDEBAR
  ===================================================== */

  sideMenu: {
    position: "absolute",

    top: 40,
    left: 0,
    bottom: 0,

    zIndex: 100,
    elevation: 20,
  },

  desktopSideMenu: {
    position: "fixed",

    top: 0,
    left: 0,
    right: undefined,
    bottom: 0,

    width:
      DESKTOP_SIDEBAR_WIDTH,

    height: "100vh",

    overflow: "hidden",

    zIndex: 100,
    elevation: 20,
  },

  mobileSideMenu: {
    position: "absolute",

    top: 40,
    left: 0,
    right: undefined,
    bottom: 0,

    zIndex: 100,
  },

  /* =====================================================
     CONTENT
  ===================================================== */

  pageContent: {
    flex: 1,
    minHeight: 0,

    overflow: "hidden",
  },

  desktopPageContent: {
    position: "absolute",

    top: 0,
    left:
      DESKTOP_SIDEBAR_WIDTH,
    right: 0,
    bottom:
      BOTTOM_NAV_HEIGHT,

    minHeight: 0,

    paddingTop: 24,
    paddingHorizontal: 28,

    overflow: "hidden",
  },

  mobilePageContent: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom:
      BOTTOM_NAV_HEIGHT,

    minHeight: 0,

    paddingTop: 72,
    paddingHorizontal: 12,

    overflow: "hidden",
  },

  profileScroll: {
    flex: 1,
    minHeight: 0,

    width: "100%",
  },

  webProfileScroll: {
    height: "100%",

    overflowY: "auto",
    overflowX: "hidden",

    WebkitOverflowScrolling:
      "touch",

    overscrollBehaviorY:
      "contain",

    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  scrollContent: {
    width: "100%",

    paddingBottom: 45,
  },

  desktopScrollContent: {
    width: "100%",
    maxWidth:
      MAX_CONTENT_WIDTH,

    alignSelf: "center",
  },

  /* =====================================================
     PAGE HEADER
  ===================================================== */

  pageHeader: {
    width: "100%",

    marginBottom: 20,
  },

  pageTitle: {
    color:
      colours.lightblue,

    fontSize: 32,
    lineHeight: 39,
    fontWeight: "800",
  },

  pageDescription: {
    color:
      "rgba(255,255,255,0.58)",

    fontSize: 14,
    lineHeight: 20,

    marginTop: 3,
  },

  /* =====================================================
     AVATAR
  ===================================================== */

  profileHeader: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",

    padding: 20,
    marginBottom: 16,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    borderRadius: 18,

    backgroundColor:
      colours.darkblue,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.14,
    shadowRadius: 9,

    elevation: 3,
  },

  compactProfileHeader: {
    flexDirection: "column",
    alignItems: "flex-start",
  },

  avatarButton: {
    position: "relative",

    width: 112,
    height: 112,

    marginRight: 20,

    borderRadius: 56,

    overflow: "hidden",

    backgroundColor:
      "rgba(255,255,255,0.08)",
  },

  avatar: {
    width: "100%",
    height: "100%",

    borderRadius: 56,

    resizeMode: "cover",
  },

  avatarOverlay: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    height: 33,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      "rgba(0,0,0,0.65)",
  },

  avatarOverlayText: {
    color: "#ffffff",

    fontSize: 12,
    fontWeight: "800",
  },

  headerInfo: {
    flex: 1,
    minWidth: 0,
  },

  profileHeading: {
    color: "#ffffff",

    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
  },

  editInfoText: {
    color:
      "rgba(255,255,255,0.52)",

    fontSize: 13,
    lineHeight: 19,

    marginTop: 4,
  },

  changePhotoButton: {
    alignSelf: "flex-start",

    minHeight: 40,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 17,

    marginTop: 13,

    borderRadius: 20,

    backgroundColor:
      "rgba(255,255,255,0.09)",
  },

  changePhotoButtonText: {
    color: "#ffffff",

    fontSize: 13,
    fontWeight: "800",
  },

  /* =====================================================
     FORM
  ===================================================== */

  formCard: {
    width: "100%",

    padding: 20,
    marginBottom: 16,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    borderRadius: 18,

    backgroundColor:
      colours.darkblue,
  },

  cardTitle: {
    color: "#ffffff",

    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },

  cardDescription: {
    color:
      "rgba(255,255,255,0.5)",

    fontSize: 13,
    lineHeight: 19,

    marginTop: 3,
    marginBottom: 18,
  },

  inputSection: {
    width: "100%",

    marginBottom: 18,
  },

  label: {
    color:
      colours.lightblue,

    fontSize: 14,
    fontWeight: "800",

    marginBottom: 7,
  },

  input: {
    width: "100%",
    minHeight: 48,

    paddingHorizontal: 14,
    paddingVertical: 11,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.1)",

    borderRadius: 11,

    color: "#ffffff",

    fontSize: 15,

    backgroundColor:
      "rgba(255,255,255,0.045)",
  },

  disabledInput: {
    color:
      "rgba(255,255,255,0.45)",

    backgroundColor:
      "rgba(255,255,255,0.025)",
  },

  inputHelper: {
    color:
      "rgba(255,255,255,0.42)",

    fontSize: 12,
    lineHeight: 17,

    marginTop: 6,
  },

  /* =====================================================
     PRIVACY
  ===================================================== */

  privacyCard: {
    width: "100%",

    padding: 20,
    marginBottom: 16,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    borderRadius: 18,

    backgroundColor:
      colours.darkblue,
  },

  privacyTextContainer: {
    width: "100%",

    marginBottom: 17,
  },

  privacyTitle: {
    color: "#ffffff",

    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },

  privacySubtitle: {
    color:
      "rgba(255,255,255,0.5)",

    fontSize: 13,
    lineHeight: 19,

    marginTop: 3,
  },

  privacyRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",

    padding: 14,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.07)",

    borderRadius: 12,

    backgroundColor:
      "rgba(255,255,255,0.035)",
  },

  privacyStatusContainer: {
    flex: 1,
    minWidth: 0,

    paddingRight: 18,
  },

  privacyLabel: {
    color: "#ffffff",

    fontSize: 15,
    fontWeight: "800",
  },

  privacyStatusDescription: {
    color:
      "rgba(255,255,255,0.46)",

    fontSize: 12,
    lineHeight: 17,

    marginTop: 2,
  },

  /* =====================================================
     SAVE
  ===================================================== */

  saveButton: {
    width: "100%",
    minHeight: 50,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 20,

    borderRadius: 25,

    backgroundColor:
      colours.lightblue,
  },

  saveButtonText: {
    color: "#ffffff",

    fontSize: 15,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.5,
  },

  unsavedText: {
    color:
      "rgba(255,255,255,0.5)",

    fontSize: 12,

    textAlign: "center",

    marginTop: 9,
  },

  /* =====================================================
     BOTTOM NAVIGATION
  ===================================================== */

  bottomNavBar: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    zIndex: 90,
  },

  desktopBottomNavBar: {
    left:
      DESKTOP_SIDEBAR_WIDTH,

    right: 0,
  },
});