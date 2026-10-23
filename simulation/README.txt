Current Primeria simulator

Run: npm run simulate -- --games 60 --seed 20261023 --output /absolute/path/results.json

Games are per board size (9,11,13,15). Use a multiple of 12 to balance all matchup/starting-seat combinations. The simulator imports the current playable bot and rules engine directly. Arithmetic costs and strengths cannot drift into a separate model. Records include the arithmetic version and source hashes.

All strengths use inexpensive tests for 2,3,5,7,11,13 at every supported length. Tests for 4,6,8,9,10 also have small costs. At intermediate speed, checking a 15-digit number through 3 costs at most 0.39 seconds including prior checks; through 11 costs at most 0.68 seconds, and all small checks through 13 cost at most 1.67 seconds. Beginner arithmetic takes 1.5x these times and advanced takes 0.7x. These are chosen assumptions, not measurements of people. Strategy, attention limits, handling time, search depth, noise and larger-prime checking still distinguish strengths.

Existing research snapshots and reports in the chat workspace are historical records. They retain their original costs and should not be reused as the default for new studies. For rule comparisons, keep this same arithmetic model on every side and change only the rule and legal move generation. Earlier reported game lengths and action mixes have not been recalculated by this change.
