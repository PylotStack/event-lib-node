import { personMovieRentalsModel } from "./1_movieRental";
import { local } from "../../src";

async function main() {
    // Create a locally stored (RAM) event stack
    const movie_rental_account_stack = local.localStack("teststack");

    // Create a model from our event stack which is empty. Notice how the view returns no items
    const personMovieRentals = await personMovieRentalsModel.fromStack(movie_rental_account_stack, undefined);

    // The view is generated automatically from the model, so we can print it out without having to compileView()
    console.log(personMovieRentals.currentlyRentedMovies);
    /**
     * []
     */

    // Let's rent a movie then take a look at our view again
    await personMovieRentals.rentMovie("The Matrix");

    // The rented movie now appears on the model
    console.log(personMovieRentals.currentlyRentedMovies);
    /**
     * [
     *   "The Matrix",
     * ]
     */
}

main();
