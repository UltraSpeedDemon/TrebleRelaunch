import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import colours from "../styles/colours";
import { getComments, addComment, deleteComment } from "../providers/rest"; // Import the API function
import { auth } from '../utils/firebase';
import { useRoute } from "@react-navigation/native";

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const ReviewCard = ({
  item,
  avatar = null,
  handleUpvote,
  handleDelete,
  navigation,
  // NEW PROPS for toggling comments/reply on/off
  showComments = true,
  showReplyInput = true,
  onUserPress,
  onReviewPress,
  onReplyConfirmation,
  profileReviewMode = false,
  compactMode = false,
}) => {

  const route = useRoute();

  const [comments, setComments] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false); // To manage loading state while posting a reply
  const [refresh, setRefresh] = useState(false);  // Add the refresh state
  const [expanded, setExpanded] = useState(false);

  /*
   * Review-card behavior depends on where it is displayed:
   *
   * - UserProfile: clicking the review opens the reviewed music.
   * - Song/Album/Artist pages: clicking the review opens its author.
   *
   * The avatar and username always open the author's profile.
   */
  const isUserProfilePage =
    profileReviewMode ||
    route?.name === "Profile" ||
    route?.name === "UserProfile" ||
    route?.name === "UserProfiles";

  const currentUserId =
    String(auth.currentUser?.uid || "");

  const reviewOwnerId =
    String(
      item?.userId ||
      item?.user_id ||
      item?.uid ||
      item?.user?.userId ||
      item?.user?.uid ||
      ""
    );

  const isOwner =
    Boolean(currentUserId) &&
    Boolean(reviewOwnerId) &&
    currentUserId === reviewOwnerId;

  const reviewMessage =
    item?.message ||
    item?.text ||
    "";

  const reviewRating = Number(
    item?.rating || 0
  );

  const reviewHearted = Boolean(
    item?.hearted
  );

  const reviewEmojis = Array.isArray(item?.emoji)
    ? item.emoji
    : Array.isArray(item?.userSelectedEmojis)
      ? item.userSelectedEmojis
      : [];

  const reviewedMusicTitle =
    item?.song?.title ||
    item?.song?.name ||
    item?.listenable?.title ||
    item?.listenable?.name ||
    item?.songTitle ||
    "";

  const needsExpansion =
    profileReviewMode &&
    reviewMessage.trim().length > 115;

  useEffect(() => {
    let active = true;

    const loadReplies = async () => {
      if (!item?.id || !showComments) {
        if (active) {
          setComments([]);
        }
        return;
      }

      try {
        const response =
          await getComments(item.id);

        if (!response?.ok) {
          throw new Error(
            `Unable to load replies (HTTP ${response?.status || "unknown"})`
          );
        }

        const data =
          await response.json();

        const loadedComments =
          Array.isArray(data)
            ? data
            : Array.isArray(data?.comments)
              ? data.comments
              : Array.isArray(data?.posts)
                ? data.posts
                : [];

        if (active) {
          setComments(loadedComments);
        }
      } catch (error) {
        console.error(
          "[Review] Reply loading error:",
          error
        );

        if (active) {
          setComments([]);
        }
      }
    };

    loadReplies();

    return () => {
      active = false;
    };
  }, [
    item?.id,
    refresh,
    showComments,
  ]);

  // Format createdAt to show only the date (no time)
  const createdAtText = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString()
    : "";

  // Confirm deletion of review
  const handleDeleteReview = (itemId) => {
    if (!isOwner) {
      Alert.alert(
        "Unable to edit",
        "You can only edit or delete your own review."
      );
      return;
    }

    Alert.alert(
      "Confirm",
      "Are you sure you want to delete this post?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes", style: "default", onPress: () => handleDelete(itemId) },
      ],
      { cancelable: true }
    );
  };

  const confirmReply = () => {
    if (!replyText.trim() || loading) {
      return;
    }

    if (typeof onReplyConfirmation === "function") {
      onReplyConfirmation({
        message: "Are you sure you want to post this reply?",
        onConfirm: handlePostReply,
      });
      return;
    }

    Alert.alert(
      "Confirm Reply",
      "Are you sure you want to post this reply?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Post", style: "default", onPress: handlePostReply },
      ]
    );
  };

  const handleDeletePost = async (postId) => {

    Alert.alert(
      "Confirm",
      "Are you sure you want to delete this post?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes", style: "default", onPress: () => handleDeleteComment(postId) },
      ],
      { cancelable: true }
    );
  }
  const handleDeleteComment = async (id) => {
    let post = comments.find(c => c.id === id)
    if (post.isUser) {
      await deleteComment(id)
      setRefresh((prev) => !prev);  // Toggle the refresh state to trigger useEffect again
    }

  }

  const handlePostReply = async () => {
    if (!replyText.trim()) {
      Alert.alert("Error", "Reply message cannot be empty!");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Error", "You must be signed in to reply.");
      return;
    }

    setLoading(true);

    try {
      /*
       * rest.js attaches the signed-in user's Firebase token.
       * The backend determines reply ownership from that token,
       * so a separate user/RID lookup is not required.
       */
      const response =
        await addComment(
          currentUser.uid,
          item.id,
          replyText.trim()
        );

      const responseText =
        await response.text();

      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.error || `Failed to post reply (HTTP ${response.status})`
        );
      }

      setReplyText("");
      setRefresh((prev) => !prev);
    } catch (error) {
      console.error("Error posting reply:", error);
      Alert.alert("Error", "Failed to post your reply.");
    } finally {
      setLoading(false);
    }
  };

  // Open the song, album, or artist attached to a profile review.
  const handleContentPress = () => {
    const rawMusic =
      item?.song ||
      item?.listenable ||
      item?.track ||
      item?.album ||
      item?.artist ||
      item?.item_info ||
      item?.itemInfo ||
      item?.music ||
      null;

    const reviewedItem =
      rawMusic?.item_info ||
      rawMusic?.itemInfo ||
      rawMusic?.data ||
      rawMusic;

    const reviewedType = String(
      reviewedItem?.type ||
      rawMusic?.type ||
      item?.type ||
      item?.listenableType ||
      item?.listenable_type ||
      "track"
    )
      .trim()
      .toLowerCase();

    if (!reviewedItem || !navigation) {
      Alert.alert(
        "Music unavailable",
        "This review does not contain enough music information to open it."
      );
      return;
    }

    const musicId =
      reviewedItem?.id ||
      reviewedItem?.listenableId ||
      reviewedItem?.listenable_id ||
      item?.listenableId ||
      item?.listenable_id;

    const normalizedMusic = {
      ...reviewedItem,
      id: musicId
        ? String(musicId)
        : reviewedItem?.id,
      listenableId: musicId
        ? String(musicId)
        : reviewedItem?.listenableId,
      title:
        reviewedItem?.title ||
        reviewedItem?.name ||
        item?.songTitle ||
        "Unknown",
      name:
        reviewedItem?.name ||
        reviewedItem?.title ||
        item?.songTitle ||
        "Unknown",
      image:
        reviewedItem?.image ||
        reviewedItem?.coverArt ||
        reviewedItem?.albumArt ||
        "",
      coverArt:
        reviewedItem?.coverArt ||
        reviewedItem?.image ||
        reviewedItem?.albumArt ||
        "",
    };

    switch (reviewedType) {
      case "album":
        navigation.navigate("AlbumPage", {
          album: {
            ...normalizedMusic,
            type: "album",
          },
        });
        break;

      case "artist":
        navigation.navigate("ArtistPage", {
          artist: {
            ...normalizedMusic,
            type: "artist",
          },
        });
        break;

      case "song":
      case "track":
      default:
        navigation.navigate("SongPage", {
          track: {
            ...normalizedMusic,
            type: "track",
          },
        });
        break;
    }
  };


  const resolvedAvatar =
    avatar ||
    item?.avatarLong ||
    item?.avatar ||
    item?.userAvatar ||
    item?.user_avatar ||
    item?.profilePicture ||
    item?.profile_picture ||
    item?.photoURL ||
    item?.photoUrl ||
    item?.user?.avatarLong ||
    item?.user?.avatar ||
    item?.user?.profilePicture ||
    null;

  const avatarSource =
    resolvedAvatar &&
    typeof resolvedAvatar === "object" &&
    (
      resolvedAvatar.uri ||
      resolvedAvatar.default
    )
      ? resolvedAvatar
      : typeof resolvedAvatar === "string" &&
        resolvedAvatar.trim()
        ? {
            uri: resolvedAvatar.trim(),
          }
        : require("../images/avatarIcon.png");

  const openUserProfile = () => {
    if (typeof onUserPress === "function") {
      onUserPress();
      return;
    }

    const reviewUserId =
      item?.userId ||
      item?.user_id ||
      item?.uid ||
      item?.user?.userId ||
      item?.user?.uid;

    if (reviewUserId && navigation) {
      navigation.navigate("UserProfiles", {
        userId: reviewUserId,
        username: item?.username || item?.userName || item?.user?.username || "",
      });
    }
  };

  const handleReviewPress = () => {
    /*
     * Profile-page review cards open the reviewed music.
     * On Song, Album, and Artist pages, only the avatar and
     * username open the review author's profile.
     */
    if (isUserProfilePage) {
      handleContentPress();
    }
  };

  const ReviewContentWrapper =
    isUserProfilePage
      ? TouchableOpacity
      : View;

  const reviewContentWrapperProps =
    isUserProfilePage
      ? {
          onPress: handleReviewPress,
          activeOpacity: 0.8,
        }
      : {};

  return (
    <View
      style={[
        styles.reviewCard,
        isUserProfilePage &&
          styles.profileReviewCard,
        isUserProfilePage &&
          !expanded &&
          styles.profileReviewCardCollapsed,
        compactMode &&
          styles.compactReviewCard,
      ]}
    >
      <View style={[styles.row, styles.reviewContent]}>
        <TouchableOpacity onPress={openUserProfile} activeOpacity={0.75}>
          <Image
            source={avatarSource}
            style={[
              styles.avatar,
              compactMode &&
                styles.compactAvatar,
            ]}
          />
        </TouchableOpacity>

        <ReviewContentWrapper
          {...reviewContentWrapperProps}
          style={styles.contentTouchable}
        >
          <View style={styles.contentContainer}>
            <View>
              {/* Inline container for username, heart and emojis */}
              <View style={styles.inlineContainer}>
                <TouchableOpacity onPress={openUserProfile} activeOpacity={0.75}>
                  <Text style={styles.username}>
                    {capitalize(item?.username || item?.userName || "User")}
                  </Text>
                </TouchableOpacity>
                {reviewHearted && (
                  <Image
                    source={require("../images/whiteFullHeart.png")}
                    style={styles.heartEmoji}
                  />
                )}
                {reviewEmojis.length > 0 ? (
                  reviewEmojis.map((emoji, index) => (
                    <Text
                      key={`${emoji}-${index}`}
                      style={styles.reviewEmoji}
                    >
                      {String(emoji).replaceAll("'", "")}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.emptyEmojiSpace}> </Text>
                )}
              </View>
              <Text
                style={[
                  styles.reviewText,
                  compactMode &&
                    styles.compactReviewText,
                ]}
                numberOfLines={
                  profileReviewMode &&
                  !expanded
                    ? 3
                    : undefined
                }
              >
                {reviewMessage}
              </Text>
            </View>
              <View style={styles.reviewInfoContainer}>
                <View style={[styles.row, styles.rateAndAction]}>
                  <View style={styles.reviewRating}>
                    {[...Array(5)].map((_, index) => (
                      <Image
                        key={index}
                        source={
                          index < reviewRating
                            ? require("../images/starFullIcon.png")
                            : require("../images/starEmptyIcon.png")
                        }
                        style={styles.reviewStar}
                      />
                    ))}
                  </View>

                  {/* Delete / Edit Buttons (if review belongs to the user) */}
                  {isOwner && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        onPress={() => handleDeleteReview(item.id)}
                        style={styles.trashButton}
                      >
                        <Image
                          source={require("../images/trash.png")}
                          style={styles.upvoteIcon}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          navigation.navigate("UpdateReview", { review: item })
                        }
                        style={styles.editPencil}
                      >
                        <Image
                          source={require("../images/editPencil.png")}
                          style={styles.upvoteIcon}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                
                {showReplyInput && !profileReviewMode ? (
                  <KeyboardAvoidingView
                    behavior={
                      Platform.OS === "ios"
                        ? "padding"
                        : undefined
                    }
                    keyboardVerticalOffset={10}
                    style={styles.replyComposer}
                  >
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Write a reply..."
                      onPressIn={(event) =>
                        event?.stopPropagation?.()
                      }
                      placeholderTextColor="rgba(255,255,255,0.48)"
                      value={replyText}
                      onChangeText={setReplyText}
                      editable={!loading}
                      multiline
                      maxLength={500}
                    />

                    <TouchableOpacity
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        confirmReply();
                      }}
                      style={[
                        styles.replyButton,
                        (
                          !replyText.trim() ||
                          loading
                        ) &&
                          styles.replyButtonDisabled,
                      ]}
                      disabled={
                        !replyText.trim() ||
                        loading
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={styles.replyText}>
                        {loading
                          ? "Posting..."
                          : "Reply"}
                      </Text>
                    </TouchableOpacity>
                  </KeyboardAvoidingView>
                ) : null}
              <View style={styles.infoAndDateContainer}>  
                {item.song && (
                  <View style={styles.songInfoContainer}>
                    <Text
                      style={styles.songTitle}
                      numberOfLines={
                        profileReviewMode &&
                        !expanded
                          ? 1
                          : undefined
                      }
                    >
                      {" "}
                      {item.song.type === "album"
                        ? item.song.title
                        : item.song.name}{" "}
                      
                      {item.song.type === "track"
                        ? "(Song)"
                        : item.song.type === "album"
                        ? "(Album)"
                        : item.song.type === "artist"
                        ? "(Artist)"
                        : ""}
                      
                    </Text>
                  </View>
                )}

              </View>
              <View style={styles.dateContainer}>
                <Text style={styles.reviewDate}>{createdAtText}</Text>
              </View>
            </View>
          </View>
        </ReviewContentWrapper>

        
      </View>

      {needsExpansion ? (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() =>
            setExpanded((value) => !value)
          }
          activeOpacity={0.8}
        >
          <Text style={styles.expandButtonText}>
            {expanded
              ? "Show Less"
              : "View More"}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Upvote Button */}
      <TouchableOpacity
          onPress={() => handleUpvote(item.id)}
          style={styles.upvoteButton}
        >
          <Image
            source={
              item.upvoted
                ? require("../images/upvoteIconBlack.png")
                : require("../images/upvoteIconWhite.png")
            }
            style={styles.upvoteIcon}
          />
          <Text style={styles.upvoteCount}>{item.upvotes}</Text>
      </TouchableOpacity>

      {/* Replies always sit underneath the original review. */}
      {showComments && !profileReviewMode ? (
        <View style={styles.commentsContainer}>
          {comments.length > 0 ? (
            <>
              <Text style={styles.repliesHeading}>
                {comments.length === 1
                  ? "1 Reply"
                  : `${comments.length} Replies`}
              </Text>

              {comments.map((comment) => (
                <CommentCard
                  key={String(
                    comment?.id ||
                    `${comment?.username}-${comment?.createdAt}`
                  )}
                  comment={comment}
                  onDelete={handleDeletePost}
                />
              ))}
            </>
          ) : (
            <Text style={styles.noRepliesText}>
              No replies yet
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
};

const CommentCard = ({
  comment,
  onDelete,
}) => {
  const commentOwnerId =
    String(
      comment?.userId ||
      comment?.user_id ||
      comment?.uid ||
      ""
    );

  const isCommentOwner =
    Boolean(auth.currentUser?.uid) &&
    String(auth.currentUser.uid) ===
      commentOwnerId;

  const commentDate =
    comment?.createdAt
      ? new Date(
          comment.createdAt
        ).toLocaleDateString()
      : "";

  return (
    <View style={styles.commentCard}>
      <Image
        source={
          comment?.avatar ||
          comment?.avatarLong ||
          comment?.profilePicture
            ? {
                uri:
                  comment.avatar ||
                  comment.avatarLong ||
                  comment.profilePicture,
              }
            : require("../images/avatarIcon.png")
        }
        style={styles.commentAvatar}
      />

      <View style={styles.commentTextContainer}>
        <View style={styles.commentHeader}>
          <Text style={styles.accountName}>
            {capitalize(
              comment?.username ||
              "User"
            )}
          </Text>

          {commentDate ? (
            <Text style={styles.commentDate}>
              {commentDate}
            </Text>
          ) : null}
        </View>

        <Text style={styles.commentText}>
          {comment?.message || ""}
        </Text>
      </View>

      {isCommentOwner ? (
        <TouchableOpacity
          onPress={() =>
            onDelete(comment.id)
          }
          style={styles.commentTrashButton}
        >
          <Image
            source={require("../images/trash.png")}
            style={styles.commentDeleteIcon}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row"
  },
  alignItemsCenter: {
    alignItems: "center"
  },
  reviewContent: {
    width: "100%",
    minHeight: 100,

    alignItems: "flex-start",

    /*
     * Keep the review text and emoji row clear of the
     * top-right upvote pill.
     */
    paddingRight: 58,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10
  },
  rateAndAction: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5
  },
  reviewCard: {
    width: "100%",

    flexDirection: "column",
    alignItems: "stretch",

    padding: 15,
    marginBottom: 10,

    borderWidth: 1,
    borderColor: "rgba(100,181,246,0.16)",
    borderRadius: 14,

    backgroundColor: colours.darkblue,

    position: "relative",
    minHeight: 100,

    overflow: "hidden",
  },

  profileReviewCard: {
    minHeight: 210,

    borderColor: "rgba(53,175,229,0.28)",
    backgroundColor:
      "rgba(18,24,35,0.96)",
  },

  profileReviewCardCollapsed: {
    height: 210,
  },

  compactReviewCard: {
    minHeight: 0,

    padding: 11,
    marginBottom: 7,

    borderRadius: 11,
  },
  contentTouchable: {
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 46,
    height: 46,

    borderWidth: 1,
    borderColor: "rgba(100,181,246,0.34)",
    borderRadius: 23,

    marginRight: 11,
    marginTop: 2,

    backgroundColor: "rgba(255,255,255,0.08)",
  },

  compactAvatar: {
    width: 36,
    height: 36,

    borderRadius: 18,

    marginRight: 8,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  username: {
    fontSize: 14,
    marginRight: 10,
    fontWeight: "bold",
    color: "#64B5F6",
  },
  reviewText: {
    color: "#FFF",

    fontSize: 14,
    lineHeight: 20,

    marginTop: 7,
    marginBottom: 5,

    paddingRight: 2,
  },

  compactReviewText: {
    fontSize: 13,
    lineHeight: 18,

    marginTop: 4,
    marginBottom: 3,
  },
  infoAndDateContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  reviewInfoContainer: {
    flex: 1,
    flexDirection: "column",
  },
  reviewRating: {
    flexDirection: "row",
  },
  heartEmoji: {
    width: 16,
    height: 16,
    marginRight: 7.5,
  },
  reviewStar: {
    width: 16,
    height: 16,
    marginRight: 2,
  },
  reviewEmojisContainer: {
    flexDirection: "row",
  },
  reviewEmoji: {
    fontSize: 12,
    marginRight: 2,
    color: "#FFF",
  },
  emptyEmojiSpace: {
    height: 20,
  },
  songInfoContainer: {
    marginTop: 5,
  },
  songTitle: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#90CAF9",
  },
  songSummary: {
    fontSize: 12,
    color: "#B0BEC5",
  },
  dateContainer: {
    justifyContent: "flex-end",
  },
  reviewDate: {
    fontSize: 12,
    color: "#FFF",
  },
  upvoteButton: {
    position: "absolute",
    top: 11,
    right: 11,

    zIndex: 30,
    elevation: 8,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    minWidth: 48,
    minHeight: 34,

    paddingHorizontal: 10,
    paddingVertical: 6,

    borderWidth: 1,
    borderColor: "rgba(100,181,246,0.32)",
    borderRadius: 17,

    backgroundColor: "rgba(18,24,35,0.94)",
  },
  upvoteIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
  },
  upvoteCount: {
    fontSize: 14,
    color: "#FFF",
  },
  hearted: {
    fontSize: 14,
    marginRight: 5,
  },
  reviewEmojisContainer: {
    flexDirection: "row",
    marginTop: 5,
  },
  inlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",

    minWidth: 0,
    paddingRight: 4,
  },
  heartEmoji: {
    width: 15,
    height: 15,
    marginRight: 10,
  },
  reviewEmoji: {
    marginRight: 4,
    fontSize: 13,
    // your emoji text styling
  },
  emptyEmojiSpace: {
  
    width: 20,
  },
  expandButton: {
    alignSelf: "flex-start",

    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,

    borderWidth: 1,
    borderColor: "rgba(53,175,229,0.28)",
    borderRadius: 10,

    backgroundColor: "rgba(53,175,229,0.08)",
  },

  expandButtonText: {
    color: colours.lightblue || "#35afe5",

    fontSize: 12,
    fontWeight: "800",
  },

  // ...rest of your styles
  commentsContainer: {
    width: "100%",

    marginTop: 5,
    paddingTop: 8,
    paddingLeft: 54,

    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  replyButton: {
    minWidth: 84,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colours.lightblue || "#64B5F6",
  },
  replyText: {
    fontSize: 14,
    color: "#FFF",
    fontWeight: "bold",
  },
  commentCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: "rgba(53,175,229,0.14)",
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  commentTextContainer: {
    flex: 1,
    minWidth: 0,

    paddingRight: 6,
  },
  commentTrashButton: {
    marginLeft: 10, // Adds spacing from the text
  },
  reviewRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  replyInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(53,175,229,0.24)",
    borderRadius: 10,
    color: "#ffffff",
    backgroundColor: "rgba(255,255,255,0.055)",
    textAlignVertical: "top",
  },
  icon: {
    width: 20,
    height: 20,
  },
  accountName: {
    color:
      colours.lightblue ||
      "#64B5F6",

    fontSize: 15,
    fontWeight: "800",
  },

  commentText: {
    color: "rgba(255,255,255,0.88)",

    fontSize: 13,
    lineHeight: 18,

    flexShrink: 1,
  },

  repliesHeading: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },

  noRepliesText: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 12,
    fontStyle: "italic",
  },

  replyComposer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 10,
  },

  replyButtonDisabled: {
    opacity: 0.45,
  },

  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },

  commentDate: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 10,
  },

  commentDeleteIcon: {
    width: 16,
    height: 16,
    resizeMode: "contain",
  },
});

export default ReviewCard;