import z from "zod";

export type AccessJwtPayload = {
  sub: string;
  username: string;
  role: "USER" | "ADMIN";
};

export type RefreshJwtPayload = AccessJwtPayload & {
  jti: string;
};

export interface RequestInfo {
  ip: string;
  userAgent: string;
  device: string;
}

export type AudioQuality =
  "data_saver" | "low" | "medium" | "high" | "ultra" | "lossless";

// Auth

export const RegisterSchema = z.object({
  email: z.email().describe("User's email address"),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(32, { message: "Password cannot exceed 32 characters" })
    .regex(/[a-z]/, {
      message: "Password must contain at least one lowercase letter",
    })
    .regex(/[A-Z]/, {
      message: "Password must contain at least one uppercase letter",
    })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .regex(/[^a-zA-Z0-9]/, {
      message: "Password must contain at least one special character",
    })
    .describe("User's password"),
  firstName: z.string().min(2).max(64).describe("User's first name"),
  lastName: z.string().min(2).max(64).describe("User's last name"),
  username: z.string().min(3).max(64).describe("Unique username"),
});

export const LoginSchema = z.object({
  username: z.string().min(3).max(64).describe("Unique username"),
  password: z.string().min(8).max(32).describe("User's password"),
});

export const VerificationCodeSchema = z.object({
  email: z.email().describe("Email address of the user"),
});

export const ForgotPasswordSchema = z.object({
  email: z.email().describe("Email address of the user"),
});

export const RefreshSchema = z.object({
  access_token: z.string().describe("Access token to access secured endpoints"),
});

export const ResetPasswordSchema = z.object({
  token: z.string().describe("Token to reset password"),
  newPassword: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(32, { message: "Password cannot exceed 100 characters" })
    .regex(/[a-z]/, {
      message: "Password must contain at least one lowercase letter",
    })
    .regex(/[A-Z]/, {
      message: "Password must contain at least one uppercase letter",
    })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .regex(/[^a-zA-Z0-9]/, {
      message: "Password must contain at least one special character",
    })
    .describe("The new password"),
});

export const SessionSchema = z.object({
  createdAt: z.iso.date().describe("The date the session was created"),
  jti: z.string().describe("The JWT token ID"),
  ipAddress: z.string().describe("The IP address of the session"),
  location: z.string().describe("The location of the session"),
  userAgent: z.string().describe("The user agent of the session"),
  deviceName: z.string().describe("The device name of the session"),
  lastUsedAt: z.iso.date().describe("The last used date of the session"),
});

// Songs

export const PlayUrlSchema = z.object({
  url: z.string().describe("The play URL"),
  expiresIn: z.number().describe("The number of seconds until the URL expires"),
});

export const SongSchema = z.object({
  id: z.uuidv4().describe("The ID of the song"),
  title: z.string().describe("The track title"),
  albumId: z.uuidv4().describe("The album id"),
  genreId: z.uuidv4().describe("The genre id"),
  duration: z.coerce.number().describe("The track duration in seconds"),
  createdAt: z.iso.date().describe("The date the song was created"),
  updatedAt: z.iso.date().describe("The date the song was last updated"),
});

export const UploadSongSchema = z.object({
  title: z.string().describe("The track title"),
  albumId: z.uuid().describe("The album id"),
  genreId: z.uuid().describe("The genre id"),
  duration: z.coerce
    .number()
    .max(1800)
    .describe("The track duration in seconds"),
});

export const UploadSongResponseSchema = z.object({
  id: z.uuidv4().describe("The ID of the song"),
  message: z
    .string()
    .describe("A message indicating the success of the upload"),
});

export const EditSongSchema = UploadSongSchema.extend({
  userId: z.array(z.uuid()).optional(), // multiple authors
}).omit({ albumId: true });

// Genres

export const GenreSchema = z.object({
  id: z.uuidv4().describe("The genre id"),
  name: z.string().min(2).max(64).describe("The name of the genre"),
  description: z
    .string()
    .min(12)
    .max(256)
    .describe("The description of the genre")
    .optional(),
  songs: z.array(SongSchema).optional(),
  createdAt: z.iso.date().describe("The date the genre was created"),
  updatedAt: z.iso.date().describe("The date the genre was last updated"),
});

export const CreateGenreSchema = z.object({
  name: z.string().min(2).max(64).describe("The name of the genre"),
  description: z
    .string()
    .min(12)
    .max(256)
    .describe("The description of the genre")
    .optional(),
});

export const EditGenreSchema = CreateGenreSchema.partial();

// User

export const GetProfileSchema = z.object({
  id: z.uuidv4().describe("The ID of the user"),
  firstName: z.string().min(2).max(64).describe("The first name of the user"),
  lastName: z.string().min(2).max(64).describe("The last name of the user"),
  username: z.string().min(3).max(64).describe("The username of the user"),
  createdAt: z.iso.date().describe("The date the user was created"),
  updatedAt: z.iso.date().describe("The date the user was last updated"),
  email: z.email().describe("Email address of the user"),
  verified: z.boolean().describe("Whether the user is verified"),
});

export const GetUserSchema = z.object({
  id: z.uuidv4().describe("The ID of the user"),
  firstName: z.string().min(2).max(64).describe("The first name of the user"),
  lastName: z.string().min(2).max(64).describe("The last name of the user"),
  username: z.string().min(3).max(64).describe("The username of the user"),
  createdAt: z.iso.date().describe("The date the user was created"),
  updatedAt: z.iso.date().describe("The date the user was last updated"),
});

export const EditUserSchema = RegisterSchema.pick({
  firstName: true,
  lastName: true,
  username: true,
});

// Playlists

export const PlaylistSchema = z.object({
  id: z.uuidv4().describe("The ID of the playlist"),
  name: z.string().describe("The name of the playlist"),
  isPublic: z.boolean().describe("Whether the playlist is public"),
  userId: z.uuidv4().describe("The ID of the user"),
  songs: z.array(SongSchema).describe("The songs in the playlist"),
  createdAt: z.iso.date().describe("The date the playlist was created"),
  updatedAt: z.iso.date().describe("The date the playlist was last updated"),
});

export const CreatePlaylistSchema = z.object({
  name: z.string().describe("The name of the playlist"),
  isPublic: z.boolean().describe("Whether the playlist is public"),
});

export const EditPlaylistSchema = CreatePlaylistSchema.partial();

// Album

export const AlbumSchema = z.object({
  id: z.uuidv4().describe("The ID of the album"),
  title: z.string().describe("Title of the album"),
  cover: z.url().describe("The cover image url of the album"),
  userId: z.uuidv4().describe("The ID of the user"),
  releaseDate: z.iso.date().describe("The release date of the album"),
  createdAt: z.iso.date().describe("The date the album was created"),
  updatedAt: z.iso.date().describe("The date the album was last updated"),
  songs: z.array(SongSchema).describe("The songs in the album").optional(),
});

export const CreateAlbumSchema = z.object({
  title: z.string().min(1).max(64).describe("Title of the album"),
  releaseDate: z.iso.date().describe("The release date of the album"),
});

export const EditAlbumSchema = CreateAlbumSchema.partial();

// Pagination

export const PaginationSchema = z.object({
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
    .describe("The offset to paginate"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .optional()
    .describe("The number of items to return"),
});

// Search

export const SearchResponseSchema = z.object({
  type: z
    .enum(["song", "album", "playlist", "user", "genre"])
    .describe("Type of the response object"),
  id: z.uuidv4().describe("The ID of the response object"),
  name: z.string().describe("The name of the response object"),
  imageUrl: z.url().describe("Url for image cover"),
});

// Generic Responses

export const MessageResponseSchema = z.object({
  message: z
    .string()
    .describe("A message sent by an endpoint in case of 2XX response"),
});

export const ErrorResponseSchema = z.object({
  statusCode: z.number().describe("The status code of the error"),
  message: z.string().describe("The error message"),
  errorCode: z.string().describe("The error code"),
});
