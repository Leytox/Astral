import { ApiProperty } from '@nestjs/swagger';

export class PlayUrl {
  @ApiProperty({
    example:
      'http://127.0.0.1:9000/songs/762a3e6b-8b01-42ce-a314-b6b86ae25b50?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=minioadmin%2F20260812%2Flocal%2Fs3%2Faws4_request&X-Amz-Date=20260812T192433Z&X-Amz-Expires=300&X-Amz-Signature=5b51cbc40267269afee494f89664e53d85930e3aeb1147b34257621005845306&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject',
  })
  url!: string;

  @ApiProperty({ example: 300 })
  expiresIn!: number;
}
