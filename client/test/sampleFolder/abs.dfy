method abs(x:int, y:int) returns (z:int)
ensures x == z || y == z;
ensures x <= z && y <= z;
ensures 0 == 0; {
  if x > y {
    return x;
  } else {
    return y;
  }
}
