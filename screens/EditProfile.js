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

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export default function EditProfile({
  navigation,
}) {
  const { width } =
    useWindowDimensions();

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

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    originalUsername,
    setOriginalUsername,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    avatar,
    setAvatar,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    uploadingAvatar,
    setUploadingAvatar,
  ] = useState(false);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    isPublic,
    setIsPublic,
  ] = useState(true);

  const [
    originalIsPublic,
    setOriginalIsPublic,
  ] = useState(true);

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  }, [isDesktopWeb]);

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
            data?.message ||
            `${fallbackMessage} HTTP ${response.status}`
        );
      }

      return data;
    },
    []
  );

  const refreshEntirePage =
    useCallback(async () => {
      await wait(1200);

      if (
        Platform.OS === "web" &&
        typeof window !== "undefined"
      ) {
        window.location.reload();
        return;
      }

      navigation.reset({
        index: 0,
        routes: [
          {
            name: "Profile",
          },
        ],
      });
    }, [navigation]);

  const fetchUserData =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setLoading(false);

        navigation.reset({
          index: 0,
          routes: [
            {
              name: "Home",
            },
          ],
        });

        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");

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

        const finalIsPublic =
          publicValue === true ||
          publicValue === "true" ||
          publicValue === 1 ||
          publicValue === undefined;

        setUsername(
          finalUsername
        );

        setOriginalUsername(
          finalUsername
        );

        setEmail(
          finalEmail
        );

        setAvatar(
          finalAvatar
        );

        setIsPublic(
          finalIsPublic
        );

        setOriginalIsPublic(
          finalIsPublic
        );
      } catch (error) {
        console.error(
          "[EditProfile] Load error:",
          error
        );

        const message =
          error?.message ||
          "Please try again.";

        setErrorMessage(
          message
        );

        if (
          Platform.OS !== "web"
        ) {
          Alert.alert(
            "Unable to load profile",
            message
          );
        }
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

  const uploadAvatarToFirebase =
    useCallback(
      async (asset) => {
        const currentUser =
          auth.currentUser;

        if (!currentUser?.uid) {
          setErrorMessage(
            "No user is currently signed in."
          );

          return;
        }

        try {
          setUploadingAvatar(true);
          setSuccessMessage("");
          setErrorMessage("");

          const preparedImage =
            await prepareAvatar(
              asset
            );

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

          const separator =
            downloadURL.includes("?")
              ? "&"
              : "?";

          const avatarURL =
            `${downloadURL}${separator}updated=${Date.now()}`;

          const updateResponse =
            await updateUser(
              currentUser.uid,
              {
                avatar:
                  avatarURL,
              }
            );

          await parseResponse(
            updateResponse,
            "Unable to save the avatar."
          );

          await updateProfile(
            currentUser,
            {
              photoURL:
                avatarURL,
            }
          );

          setAvatar(
            avatarURL
          );

          setSuccessMessage(
            "Your profile picture was updated successfully. Refreshing your profile..."
          );

          await refreshEntirePage();
        } catch (error) {
          console.error(
            "[EditProfile] Avatar upload error:",
            error
          );

          const message =
            error?.message ||
            "Please try another image.";

          setErrorMessage(
            `Unable to update avatar: ${message}`
          );

          if (
            Platform.OS !== "web"
          ) {
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
        refreshEntirePage,
      ]
    );

  const handlePickAvatar =
    useCallback(async () => {
      if (
        uploadingAvatar ||
        saving
      ) {
        return;
      }

      try {
        setSuccessMessage("");
        setErrorMessage("");

        if (
          Platform.OS !== "web"
        ) {
          const permissionResult =
            await ImagePicker
              .requestMediaLibraryPermissionsAsync();

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
          await ImagePicker
            .launchImageLibraryAsync({
              mediaTypes:
                ImagePicker
                  .MediaTypeOptions
                  .Images,

              allowsEditing:
                true,

              aspect:
                [1, 1],

              quality:
                0.9,
            });

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

        const message =
          error?.message ||
          "Please try again.";

        setErrorMessage(
          `Unable to select image: ${message}`
        );

        if (
          Platform.OS !== "web"
        ) {
          Alert.alert(
            "Unable to select image",
            message
          );
        }
      }
    }, [
      saving,
      uploadAvatarToFirebase,
      uploadingAvatar,
    ]);

  const handleSave =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setErrorMessage(
          "You are not signed in. Please sign in again."
        );

        return;
      }

      const newUsername =
        username.trim();

      setSuccessMessage("");
      setErrorMessage("");

      if (!newUsername) {
        setErrorMessage(
          "Please enter a username."
        );

        return;
      }

      if (
        newUsername.length < 3
      ) {
        setErrorMessage(
          "Your username must contain at least three characters."
        );

        return;
      }

      if (
        newUsername.length > 30
      ) {
        setErrorMessage(
          "Your username must contain 30 characters or fewer."
        );

        return;
      }

      if (
        !/^[a-z0-9._-]+$/i.test(
          newUsername
        )
      ) {
        setErrorMessage(
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

        setOriginalIsPublic(
          Boolean(isPublic)
        );

        setSuccessMessage(
          "Your profile was updated successfully. Refreshing your profile..."
        );

        await refreshEntirePage();
      } catch (error) {
        console.error(
          "[EditProfile] Save error:",
          error
        );

        const message =
          error?.message ||
          "Please try again.";

        setErrorMessage(
          `Unable to save profile: ${message}`
        );

        if (
          Platform.OS !== "web"
        ) {
          Alert.alert(
            "Unable to save profile",
            message
          );
        }
      } finally {
        setSaving(false);
      }
    }, [
      avatar,
      isPublic,
      parseResponse,
      refreshEntirePage,
      username,
    ]);

  const avatarIsValid =
    avatar &&
    typeof avatar === "string" &&
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
    );

  const avatarSource =
    avatarIsValid
      ? {
          uri: avatar,
        }
      : FALLBACK_AVATAR;

  const hasUsernameChanges =
    username.trim() !==
    originalUsername.trim();

  const hasPrivacyChanges =
    Boolean(isPublic) !==
    Boolean(originalIsPublic);

  const hasChanges =
    hasUsernameChanges ||
    hasPrivacyChanges;

  const pageBusy =
    saving ||
    uploadingAvatar;

  if (loading) {
    return (
      <View
        style={
          styles.loader
        }
      >
        <ActivityIndicator
          size="large"
          color={
            colours.lightblue ||
            "#54b7ee"
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
              Update your username, profile picture, and privacy settings.
            </Text>
          </View>

          {successMessage ? (
            <View
              style={
                styles.successBanner
              }
            >
              <Text
                style={
                  styles.successIcon
                }
              >
                ✓
              </Text>

              <View
                style={
                  styles.messageTextContainer
                }
              >
                <Text
                  style={
                    styles.successTitle
                  }
                >
                  Successfully saved
                </Text>

                <Text
                  style={
                    styles.successText
                  }
                >
                  {successMessage}
                </Text>
              </View>
            </View>
          ) : null}

          {errorMessage ? (
            <View
              style={
                styles.errorBanner
              }
            >
              <Text
                style={
                  styles.errorIcon
                }
              >
                !
              </Text>

              <View
                style={
                  styles.messageTextContainer
                }
              >
                <Text
                  style={
                    styles.errorTitle
                  }
                >
                  Something went wrong
                </Text>

                <Text
                  style={
                    styles.errorText
                  }
                >
                  {errorMessage}
                </Text>
              </View>
            </View>
          ) : null}

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
                pageBusy
              }
              activeOpacity={
                0.8
              }
            >
              <Image
                key={
                  typeof avatar === "string"
                    ? avatar
                    : "fallback-avatar"
                }
                source={
                  avatarSource
                }
                style={
                  styles.avatar
                }
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
                Select an image. It will be cropped and resized automatically.
              </Text>

              <TouchableOpacity
                style={[
                  styles.changePhotoButton,

                  pageBusy &&
                    styles.disabledButton,
                ]}
                onPress={
                  handlePickAvatar
                }
                disabled={
                  pageBusy
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
                      styles.changePhotoButtonText
                    }
                  >
                    Change Photo
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

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
                style={
                  styles.input
                }
                value={
                  username
                }
                onChangeText={(value) => {
                  setUsername(
                    value
                  );

                  setSuccessMessage("");
                  setErrorMessage("");
                }}
                placeholder="Enter your username"
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="words"
                autoCorrect={false}
                spellCheck={false}
                maxLength={30}
                editable={
                  !pageBusy
                }
                returnKeyType="done"
                onSubmitEditing={
                  handleSave
                }
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
                value={
                  email
                }
                editable={
                  false
                }
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
                value={
                  isPublic
                }
                onValueChange={(value) => {
                  setIsPublic(
                    value
                  );

                  setSuccessMessage("");
                  setErrorMessage("");
                }}
                disabled={
                  pageBusy
                }
                trackColor={{
                  false:
                    "rgba(255,255,255,0.18)",

                  true:
                    colours.lightblue ||
                    "#54b7ee",
                }}
                thumbColor="#ffffff"
                ios_backgroundColor="rgba(255,255,255,0.18)"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,

              pageBusy &&
                styles.disabledButton,
            ]}
            onPress={
              handleSave
            }
            disabled={
              pageBusy
            }
            activeOpacity={
              0.8
            }
          >
            {saving ? (
              <>
                <ActivityIndicator
                  size="small"
                  color="#ffffff"
                />

                <Text
                  style={
                    styles.savingButtonText
                  }
                >
                  Saving...
                </Text>
              </>
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

          {hasChanges &&
          !successMessage ? (
            <Text
              style={
                styles.unsavedText
              }
            >
              You have unsaved profile changes.
            </Text>
          ) : null}
        </ScrollView>
      </View>

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

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,

      backgroundColor:
        colours.background ||
        colours.bluegrey ||
        "#111b29",
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
        colours.background ||
        colours.bluegrey ||
        "#111b29",
    },

    loadingText: {
      color:
        "rgba(255,255,255,0.7)",

      fontSize: 14,

      marginTop: 12,
    },

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

    pageHeader: {
      width: "100%",

      marginBottom: 20,
    },

    pageTitle: {
      color:
        colours.lightblue ||
        "#54b7ee",

      fontSize: 32,
      lineHeight: 39,
      fontWeight: "800",
    },

    pageDescription: {
      color:
        "rgba(255,255,255,0.6)",

      fontSize: 14,
      lineHeight: 20,

      marginTop: 3,
    },

    successBanner: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      padding: 16,
      marginBottom: 18,

      borderWidth: 1,
      borderColor:
        "rgba(65,210,125,0.55)",

      borderRadius: 14,

      backgroundColor:
        "rgba(40,190,105,0.14)",
    },

    successIcon: {
      width: 34,
      height: 34,

      color: "#ffffff",

      fontSize: 20,
      lineHeight: 32,
      fontWeight: "900",

      textAlign: "center",

      marginRight: 12,

      borderRadius: 17,

      backgroundColor:
        "#27ae60",
    },

    successTitle: {
      color: "#7ff0aa",

      fontSize: 15,
      fontWeight: "800",
    },

    successText: {
      color:
        "rgba(255,255,255,0.78)",

      fontSize: 13,
      lineHeight: 19,

      marginTop: 2,
    },

    errorBanner: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      padding: 16,
      marginBottom: 18,

      borderWidth: 1,
      borderColor:
        "rgba(255,85,95,0.55)",

      borderRadius: 14,

      backgroundColor:
        "rgba(255,65,75,0.12)",
    },

    errorIcon: {
      width: 34,
      height: 34,

      color: "#ffffff",

      fontSize: 21,
      lineHeight: 32,
      fontWeight: "900",

      textAlign: "center",

      marginRight: 12,

      borderRadius: 17,

      backgroundColor:
        "#e74c3c",
    },

    errorTitle: {
      color: "#ff8e96",

      fontSize: 15,
      fontWeight: "800",
    },

    errorText: {
      color:
        "rgba(255,255,255,0.78)",

      fontSize: 13,
      lineHeight: 19,

      marginTop: 2,
    },

    messageTextContainer: {
      flex: 1,
      minWidth: 0,
    },

    profileHeader: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      padding: 20,
      marginBottom: 18,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.1)",

      borderRadius: 18,

      backgroundColor:
        "rgba(255,255,255,0.045)",
    },

    compactProfileHeader: {
      flexDirection: "column",

      alignItems: "center",
    },

    avatarButton: {
      position: "relative",

      width: 130,
      height: 130,

      flexShrink: 0,

      borderRadius: 65,

      overflow: "hidden",

      backgroundColor:
        "rgba(255,255,255,0.08)",
    },

    avatar: {
      width: 130,
      height: 130,

      borderRadius: 65,

      resizeMode: "cover",
    },

    avatarOverlay: {
      position: "absolute",

      left: 0,
      right: 0,
      bottom: 0,

      height: 38,

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        "rgba(0,0,0,0.62)",
    },

    avatarOverlayText: {
      color: "#ffffff",

      fontSize: 13,
      fontWeight: "800",
    },

    headerInfo: {
      flex: 1,

      minWidth: 0,

      marginLeft: 22,
    },

    profileHeading: {
      color: "#ffffff",

      fontSize: 21,
      lineHeight: 27,
      fontWeight: "800",
    },

    editInfoText: {
      color:
        "rgba(255,255,255,0.57)",

      fontSize: 13,
      lineHeight: 19,

      marginTop: 5,
      marginBottom: 14,
    },

    changePhotoButton: {
      alignSelf: "flex-start",

      minWidth: 145,
      height: 42,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 18,

      borderWidth: 1,
      borderColor:
        colours.lightblue ||
        "#54b7ee",

      borderRadius: 21,

      backgroundColor:
        "rgba(60,170,230,0.13)",
    },

    changePhotoButtonText: {
      color: "#ffffff",

      fontSize: 14,
      fontWeight: "800",
    },

    formCard: {
      width: "100%",

      padding: 20,
      marginBottom: 18,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.1)",

      borderRadius: 18,

      backgroundColor:
        "rgba(255,255,255,0.045)",
    },

    cardTitle: {
      color: "#ffffff",

      fontSize: 20,
      lineHeight: 26,
      fontWeight: "800",
    },

    cardDescription: {
      color:
        "rgba(255,255,255,0.56)",

      fontSize: 13,
      lineHeight: 19,

      marginTop: 4,
      marginBottom: 22,
    },

    inputSection: {
      width: "100%",

      marginBottom: 20,
    },

    label: {
      color: "#ffffff",

      fontSize: 14,
      fontWeight: "800",

      marginBottom: 8,
    },

    input: {
      width: "100%",
      height: 52,

      color: "#ffffff",

      fontSize: 16,

      paddingHorizontal: 15,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.18)",

      borderRadius: 12,

      backgroundColor:
        "rgba(255,255,255,0.055)",

      outlineStyle: "none",
    },

    disabledInput: {
      color:
        "rgba(255,255,255,0.48)",

      backgroundColor:
        "rgba(255,255,255,0.025)",
    },

    inputHelper: {
      color:
        "rgba(255,255,255,0.42)",

      fontSize: 12,
      lineHeight: 17,

      marginTop: 7,
    },

    privacyCard: {
      width: "100%",

      padding: 20,
      marginBottom: 18,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.1)",

      borderRadius: 18,

      backgroundColor:
        "rgba(255,255,255,0.045)",
    },

    privacyTextContainer: {
      width: "100%",

      marginBottom: 18,
    },

    privacyTitle: {
      color: "#ffffff",

      fontSize: 20,
      lineHeight: 26,
      fontWeight: "800",
    },

    privacySubtitle: {
      color:
        "rgba(255,255,255,0.56)",

      fontSize: 13,
      lineHeight: 19,

      marginTop: 4,
    },

    privacyRow: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",

      paddingTop: 16,

      borderTopWidth: 1,
      borderTopColor:
        "rgba(255,255,255,0.08)",
    },

    privacyStatusContainer: {
      flex: 1,

      minWidth: 0,

      paddingRight: 16,
    },

    privacyLabel: {
      color: "#ffffff",

      fontSize: 15,
      fontWeight: "800",
    },

    privacyStatusDescription: {
      color:
        "rgba(255,255,255,0.48)",

      fontSize: 12,
      lineHeight: 17,

      marginTop: 3,
    },

    saveButton: {
      width: "100%",
      height: 54,

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",

      borderRadius: 27,

      backgroundColor:
        colours.primaryblue ||
        colours.lightblue ||
        "#289bd6",
    },

    saveButtonText: {
      color: "#ffffff",

      fontSize: 16,
      fontWeight: "900",
    },

    savingButtonText: {
      color: "#ffffff",

      fontSize: 16,
      fontWeight: "900",

      marginLeft: 10,
    },

    disabledButton: {
      opacity: 0.55,
    },

    unsavedText: {
      color:
        "rgba(255,215,100,0.82)",

      fontSize: 12,
      lineHeight: 18,

      textAlign: "center",

      marginTop: 10,
    },

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