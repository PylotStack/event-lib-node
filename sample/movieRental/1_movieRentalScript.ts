import { personMovieRentals, currentlyRentedMoviesView } from "./1_movieRental";
import { compileView, executeAction } from "../../src/lib";
import { local } from "../../src";

async function main() {
    // Create a locally stored (RAM) event stack
    const movie_rental_account_stack = local.localStack("teststack");

    // Generate the view state from the event stack we recently created which is empty. Notice how the view returns no items
    const result = await compileView(movie_rental_account_stack, currentlyRentedMoviesView.definition);

    console.log(result);
    /**
     * {
     *   movies: []
     * }
     */

    // Execute and store the rent movie action on the event stack
    await executeAction(movie_rental_account_stack, personMovieRentals.definition.actions.RENT_MOVIE, { movieName: "The Matrix" });

    // Generate the view again now that we have a new event on the event stack
    const result2 = await compileView(movie_rental_account_stack, currentlyRentedMoviesView.definition);

    // The rented movie now appears in the view
    console.log(result2);
    /**
     * {
     *   movies: [
     *     "The Matrix",
     *   ] 
     * }
     */
}

main();
